import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, getRedirectUrl } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, role: 'coach' | 'client' | 'admin', firstName: string, lastName: string) => Promise<any>;
  signOut: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const mapSupabaseUserToUser = async (supabaseUser: SupabaseUser): Promise<User> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, first_name, last_name, email, avatar_url')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
      }

      console.log('=== AUTH CONTEXT DEBUG ===');
      console.log('Profile from DB:', profile);
      console.log('User metadata role:', supabaseUser.user_metadata?.role);
      console.log('Final role being set:', profile?.role || supabaseUser.user_metadata?.role || 'client');
      console.log('User email:', profile?.email || supabaseUser.email);

      return {
        id: supabaseUser.id,
        email: profile?.email || supabaseUser.email || '',
        role: profile?.role || supabaseUser.user_metadata?.role || 'client',
        firstName: profile?.first_name || supabaseUser.user_metadata?.first_name || '',
        lastName: profile?.last_name || supabaseUser.user_metadata?.last_name || '',
        avatar: profile?.avatar_url || supabaseUser.user_metadata?.avatar,
        createdAt: supabaseUser.created_at,
      };
    } catch (error) {
      console.error('Error mapping user:', error);
      return {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        role: supabaseUser.user_metadata?.role || 'client',
        firstName: supabaseUser.user_metadata?.first_name || '',
        lastName: supabaseUser.user_metadata?.last_name || '',
        avatar: supabaseUser.user_metadata?.avatar,
        createdAt: supabaseUser.created_at,
      };
    }
  };

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('AuthContext: Initial session check:', session?.user?.id);
        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!profile || profileError) {
            // Profile doesn't exist yet - this can happen with OAuth sign-ins.
            // Let the onAuthStateChange SIGNED_IN handler create it.
            const mappedUser = await mapSupabaseUserToUser(session.user);
            setUser(mappedUser);
          } else {
            const mappedUser = await mapSupabaseUserToUser(session.user);
            setUser(mappedUser);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
          try {
            console.log('AuthContext: Auth state change event:', event, 'User ID:', session?.user?.id);

            if (event === 'SIGNED_IN' && session?.user) {
              console.log('AuthContext: User signed in, checking profile...');
              const mappedUser = await mapSupabaseUserToUser(session.user);
              setUser(mappedUser);

              // Check if profile exists, if not create it (handles both email and OAuth signups)
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              if (!profile && !profileError) {
                console.log('AuthContext: Profile missing, creating...');
                const userMetadata = session.user.user_metadata || {};

                // Extract name from OAuth providers or user_metadata
                let firstName = userMetadata.first_name || '';
                let lastName = userMetadata.last_name || '';

                if (!firstName && userMetadata.full_name) {
                  const parts = userMetadata.full_name.split(' ');
                  firstName = parts[0] || '';
                  lastName = parts.slice(1).join(' ') || '';
                }
                if (!firstName && userMetadata.name) {
                  const parts = userMetadata.name.split(' ');
                  firstName = parts[0] || '';
                  lastName = parts.slice(1).join(' ') || '';
                }

                firstName = firstName || 'User';
                lastName = lastName || '';

                const { data: profileResult, error: createError } = await supabase.rpc('create_profile_for_user', {
                  user_id: session.user.id,
                  user_email: session.user.email,
                  user_role: userMetadata.role || 'client',
                  first_name: firstName,
                  last_name: lastName
                });

                if (createError) {
                  console.error('AuthContext: Failed to create profile (RPC error):', createError);
                } else if (profileResult && !profileResult.success) {
                  console.error('AuthContext: Failed to create profile:', profileResult.error);
                } else {
                  console.log('AuthContext: Profile created successfully:', profileResult);
                  // Re-map user to pick up the new profile
                  const updatedUser = await mapSupabaseUserToUser(session.user);
                  setUser(updatedUser);
                }
              }
            } else if (session?.user) {
              const mappedUser = await mapSupabaseUserToUser(session.user);
              setUser(mappedUser);
            } else {
              setUser(null);
            }
          } catch (error) {
            console.error('Error in auth state change:', error);
            setUser(null);
          }
        })();
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error.message, error);
        
        // Provide more specific error messages
        if (error.message.includes('Invalid login credentials')) {
          return { data, error: { message: 'Invalid email or password. Please check your credentials and try again.' } };
        }
        if (error.message.includes('Too many requests')) {
          return { data, error: { message: 'Too many login attempts. Please wait a few minutes and try again.' } };
        }
        if (error.message.includes('Database error granting user')) {
          return { data, error: { message: 'Database connection issue. Please try again in a moment or contact support.' } };
        }
        
        return { data, error };
      }
      
      console.log('Sign in successful:', data);
      
      // Check if profile exists for this user
      if (data.user) {
        console.log('Checking profile for user:', data.user.id);
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        
        if (!profile) {
          console.warn('Profile not found for user, attempting to create:', data.user.id);
          
          // Try to create the missing profile
          const userMetadata = data.user.user_metadata || {};
          const role = userMetadata.role || 'client';
          const firstName = userMetadata.first_name || 'User';
          const lastName = userMetadata.last_name || 'Name';
          
          const { data: profileResult, error: createError } = await supabase.rpc('create_profile_for_user', {
            user_id: data.user.id,
            user_email: data.user.email,
            user_role: role,
            first_name: firstName,
            last_name: lastName
          });

          if (createError) {
            console.error('Failed to create profile (RPC error):', createError);
            // Don't fail login just because profile creation failed
            console.warn('Profile creation failed, but allowing login to proceed');
          } else if (profileResult && !profileResult.success) {
            console.error('Failed to create profile:', profileResult.error);
            console.warn('Profile creation failed, but allowing login to proceed');
          } else {
            console.log('Successfully created missing profile:', profileResult);
          }
        } else if (profile) {
          console.log('Profile found for user:', profile);
        } else if (profileError) {
          console.error('Profile query error:', profileError);
          // Don't fail login for profile query errors
          console.warn('Profile query failed, but allowing login to proceed');
        }
      }
      
      return { data, error };
    } catch (err) {
      console.error('Unexpected sign in error:', err);
      return { 
        data: null, 
        error: { 
          message: err instanceof Error ? `Sign in failed: ${err.message}` : 'An unexpected error occurred during sign in. Please try again.'
        } 
      };
    }
  };

  const signUp = async (email: string, password: string, role: 'coach' | 'client' | 'admin', firstName: string, lastName: string, autoSubscribe: boolean = false) => {
    console.log('Signing up user:', { email, role, firstName, lastName, autoSubscribe });

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getRedirectUrl('/'),
          data: {
            role,
            first_name: firstName,
            last_name: lastName,
            auto_subscribe: autoSubscribe,
          },
        },
      });
      
      if (error) {
        console.error('Signup error:', error);

        // Check for duplicate email errors specifically
        if (error.message?.includes('User already registered') ||
            error.message?.includes('already registered') ||
            error.message?.includes('already exists')) {
          return {
            data,
            error: {
              message: 'This email is already registered. Please sign in instead, or use "Forgot Password" if you need to reset your password.'
            }
          };
        }

        // Return the actual error for debugging
        return { data, error };
      }
      
      console.log('Signup successful:', data);
      
      // If user was created but no session (email confirmation required)
      if (data.user && !data.session) {
        console.log('User created, email confirmation may be required');
        return { data, error: null }; // This is actually success for email confirmation flow
      }
      
      // If we have a session, try to ensure profile exists
      if (data.user && data.session) {
        console.log('User created with session, creating profile');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          console.log('Profile not found, creating new profile');

          // Create profile using our new function
          const priceId = import.meta.env.VITE_STRIPE_GOLF_SUBSCRIPTION_PRICE_ID || 'price_1234567890abcdef';
          const { data: profileResult, error: createError } = await supabase.rpc('create_profile_for_user', {
            user_id: data.user.id,
            user_email: data.user.email,
            user_role: role,
            first_name: firstName,
            last_name: lastName,
            auto_subscribe: autoSubscribe,
            price_id: priceId
          });

          if (createError) {
            console.error('Profile creation RPC error during signup:', createError);
            return {
              data,
              error: { message: `Database error saving new user: ${createError.message}` }
            };
          } else if (profileResult && !profileResult.success) {
            console.error('Profile creation failed during signup:', profileResult.error);
            return {
              data,
              error: { message: `Database error saving new user: ${profileResult.error}` }
            };
          } else {
            console.log('Profile created successfully during signup:', profileResult);
          }
        } else if (profile) {
          console.log('Profile found:', profile);
          // Don't fail signup just because profile creation failed
        }

        // Check for active promotions and auto-apply
        try {
          const { data: activePromotions, error: promoError } = await supabase
            .rpc('get_active_promotions');

          if (!promoError && activePromotions && activePromotions.length > 0) {
            console.log('Found active promotions:', activePromotions);

            // Apply the first active promotion (highest discount)
            const promotion = activePromotions[0];
            const { data: applyResult } = await supabase
              .rpc('apply_promotion_to_user', {
                p_user_id: data.user.id,
                p_promotion_id: promotion.id
              });

            if (applyResult?.success) {
              console.log('Successfully applied promotion to new user:', promotion.name);
            }
          }
        } catch (promoError) {
          console.error('Error applying promotions:', promoError);
          // Don't fail signup if promotion application fails
        }
      }
      
      return { data, error };
    } catch (err) {
      console.error('Unexpected signup error:', err);
      return { 
        data: null, 
        error: { 
          message: err instanceof Error ? `Signup failed: ${err.message}` : 'An unexpected error occurred during signup. Please try again.'
        } 
      };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};