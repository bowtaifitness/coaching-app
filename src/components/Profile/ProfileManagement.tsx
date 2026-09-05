import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { User, Mail, Phone, Calendar, Lock, Save, CreditCard, Eye, EyeOff, Camera, Loader, CheckCircle, AlertCircle, Shield, Bell, Globe, Trash2 } from 'lucide-react';
import PaymentInterface from '../Payments/PaymentInterface';

interface NotificationPreferences {
  email_upcoming_workout: boolean;
  email_completed: boolean;
  email_block_end: boolean;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email_upcoming_workout: false,
  email_completed: false,
  email_block_end: false,
};

interface ProfileData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  updated_at: string;
  notification_preferences?: NotificationPreferences;
}

const ProfileManagement: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const profileFormRef = useRef<HTMLFormElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // If no profile exists, set to null
      if (!profileData) {
        setProfile(null);
        return;
      }

      // Get email from auth user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      setProfile({
        ...profileData,
        email: authUser?.email || profileData.email || ''
      });
      const prefs = profileData.notification_preferences || {};
      setNotificationPrefs({
        email_upcoming_workout: prefs.email_upcoming_workout ?? false,
        email_completed: prefs.email_completed ?? false,
        email_block_end: prefs.email_block_end ?? false,
      });

    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file || !user) return;

    const { validateAvatarFile, magicBytesMatch, safeExtensionFor, safeRandomId } =
      await import('../../lib/mediaValidation');

    const validation = validateAvatarFile(file);
    if (!validation.ok) {
      setError(validation.error ?? 'Invalid image file.');
      input.value = '';
      return;
    }
    if (!(await magicBytesMatch(file, 'image'))) {
      setError('File contents do not match a supported image format.');
      input.value = '';
      return;
    }

    try {
      setUploadingAvatar(true);
      setError('');
      setSuccess('');

      // Delete old avatar if exists; restrict path to this user's namespace.
      if (profile?.avatar_url) {
        const marker = `avatars/${user.id}/`;
        const idx = profile.avatar_url.indexOf(marker);
        if (idx >= 0) {
          const tail = profile.avatar_url.slice(idx + marker.length).split(/[?#]/)[0];
          if (tail && !tail.includes('/') && !tail.includes('..')) {
            await supabase.storage.from('attachments').remove([`${marker}${tail}`]);
          }
        }
      }

      const ext = safeExtensionFor(file.type);
      const fileName = `${safeRandomId()}.${ext}`;
      const filePath = `avatars/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
      setSuccess('Profile picture updated successfully!');

    } catch (error) {
      console.error('Error uploading avatar:', error);
      setError('Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileFormRef.current || !profile) return;

    const formData = new FormData(profileFormRef.current);
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const updates = {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
        phone: formData.get('phone') as string || null,
        date_of_birth: formData.get('dateOfBirth') as string || null,
        updated_at: new Date().toISOString()
      };

      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update email in auth if changed
      const newEmail = formData.get('email') as string;
      if (newEmail !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: newEmail
        });

        if (emailError) {
          console.warn('Email update failed:', emailError);
          setError('Profile updated but email change failed. You may need to verify the new email.');
        } else {
          setSuccess('Profile updated successfully! Please check your email to confirm the new email address.');
        }
      } else {
        setSuccess('Profile updated successfully!');
      }

      // Refresh profile data
      await fetchProfile();

    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      setSuccess('Password updated successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);

    } catch (error) {
      console.error('Error updating password:', error);
      setError('Failed to update password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.'
    );

    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      'This will permanently delete your account and all associated data. Type "DELETE" in the next prompt to confirm.'
    );

    if (!doubleConfirmed) return;

    const deleteConfirmation = prompt('Type "DELETE" to confirm account deletion:');
    if (deleteConfirmation !== 'DELETE') {
      alert('Account deletion cancelled.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Note: In a production app, you'd want to handle this server-side
      // For now, we'll just sign out the user
      await supabase.auth.signOut();
      
      alert('Account deletion initiated. Please contact support to complete the process.');

    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account. Please contact support.');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = (key: keyof NotificationPreferences) => {
    setNotificationPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveNotificationPrefs = async () => {
    if (!user) return;

    try {
      setSavingPrefs(true);
      setError('');
      setSuccess('');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          notification_preferences: notificationPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      setSuccess('Notification preferences saved successfully!');
    } catch (err) {
      console.error('Error saving notification preferences:', err);
      setError('Failed to save notification preferences. Please try again.');
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-red-800">Profile Not Found</h3>
          </div>
          <p className="text-red-700 mt-2">Unable to load your profile data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
        <p className="text-gray-600">Manage your account information and preferences.</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
            <p className="text-blue-800">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Profile Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-center mb-6">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div className="relative inline-block">
                <div className="h-24 w-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden relative">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`${profile.first_name} ${profile.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-2xl">
                      {profile.first_name[0]}{profile.last_name[0]}
                    </span>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <Loader className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <button
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingAvatar ? (
                    <Loader className="h-4 w-4 text-gray-600 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 text-gray-600" />
                  )}
                </button>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {profile.first_name} {profile.last_name}
              </h3>
              <p className="text-sm text-gray-600 capitalize">{profile.role}</p>
              <p className="text-xs text-gray-500 mt-1">
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>

            <nav className="space-y-2">
              {[
                { id: 'personal', label: 'Personal Info', icon: User },
                { id: 'billing', label: 'Billing', icon: CreditCard },
                { id: 'security', label: 'Security', icon: Shield },
                { id: 'preferences', label: 'Notifications', icon: Bell },
                { id: 'danger', label: 'Account', icon: Trash2 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-3" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 min-w-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Personal Information Tab */}
            {activeTab === 'personal' && (
              <div className="p-6">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                  <p className="text-gray-600">Update your personal details and contact information.</p>
                </div>

                <form ref={profileFormRef} onSubmit={handleProfileUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                      </label>
                      <input
                        name="firstName"
                        type="text"
                        defaultValue={profile.first_name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name
                      </label>
                      <input
                        name="lastName"
                        type="text"
                        defaultValue={profile.last_name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                      <input
                        name="email"
                        type="email"
                        defaultValue={profile.email}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Changing your email will require verification
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                      <input
                        name="phone"
                        type="tel"
                        defaultValue={profile.phone || ''}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <div className="relative overflow-hidden">
                      <Calendar className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                      <input
                        name="dateOfBirth"
                        type="date"
                        defaultValue={profile.date_of_birth || ''}
                        className="w-full max-w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <PaymentInterface />
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="p-6">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
                  <p className="text-gray-600">Manage your password and account security.</p>
                </div>

                <div className="space-y-6">
                  {/* Password Section */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-gray-900">Password</h4>
                        <p className="text-sm text-gray-600">Last updated: Unknown</p>
                      </div>
                      <button
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                        className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Change Password
                      </button>
                    </div>

                    {showPasswordForm && (
                      <form onSubmit={handlePasswordChange} className="space-y-4 mt-4 pt-4 border-t border-gray-200">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Current Password
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords.current ? 'text' : 'password'}
                              value={passwordForm.currentPassword}
                              onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter current password"
                              required
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                            >
                              {showPasswords.current ? (
                                <EyeOff className="h-5 w-5 text-gray-400" />
                              ) : (
                                <Eye className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords.new ? 'text' : 'password'}
                              value={passwordForm.newPassword}
                              onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Enter new password"
                              required
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                            >
                              {showPasswords.new ? (
                                <EyeOff className="h-5 w-5 text-gray-400" />
                              ) : (
                                <Eye className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Must be at least 6 characters long
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords.confirm ? 'text' : 'password'}
                              value={passwordForm.confirmPassword}
                              onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Confirm new password"
                              required
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                            >
                              {showPasswords.confirm ? (
                                <EyeOff className="h-5 w-5 text-gray-400" />
                              ) : (
                                <Eye className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex space-x-3">
                          <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving ? (
                              <>
                                <Loader className="h-4 w-4 mr-2 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Update Password
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPasswordForm(false);
                              setPasswordForm({
                                currentPassword: '',
                                newPassword: '',
                                confirmPassword: ''
                              });
                            }}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Account Info */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Account Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Account Type</span>
                        <span className="font-medium text-gray-900 capitalize">{profile.role}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Member Since</span>
                        <span className="font-medium text-gray-900">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Last Updated</span>
                        <span className="font-medium text-gray-900">
                          {new Date(profile.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="p-6">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Notification Settings</h3>
                  <p className="text-gray-600">Choose when you'd like to receive email notifications.</p>
                </div>

                <div className="space-y-8">
                  {/* Email Notifications */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Mail className="h-5 w-5 text-blue-700" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Email Notifications</h4>
                        <p className="text-sm text-gray-600">Receive updates at your account email address</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {([
                        { key: 'email_upcoming_workout' as const, label: 'Upcoming Workout Reminders', description: 'Get notified before scheduled workouts' },
                        { key: 'email_completed' as const, label: 'Workout Completed', description: 'Confirmation when you finish a workout' },
                        { key: 'email_block_end' as const, label: 'Block/Phase Completion', description: 'Notified when a training block ends' },
                      ]).map((setting) => (
                        <div key={setting.key} className="flex items-center justify-between py-2">
                          <div className="pr-4">
                            <p className="font-medium text-gray-900 text-sm">{setting.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{setting.description}</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={notificationPrefs[setting.key]}
                            onClick={() => handleNotificationToggle(setting.key)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              notificationPrefs[setting.key] ? 'bg-blue-500' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                notificationPrefs[setting.key] ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleSaveNotificationPrefs}
                      disabled={savingPrefs}
                      className="flex items-center px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPrefs ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Notification Settings
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Account Management Tab */}
            {activeTab === 'danger' && (
              <div className="p-6">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Account Management</h3>
                  <p className="text-gray-600">Manage your account settings and data.</p>
                </div>

                <div className="space-y-6">
                  {/* Export Data */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-2">Export Your Data</h4>
                        <p className="text-blue-800 text-sm">
                          Download a copy of all your data including workouts, performance metrics, and messages.
                        </p>
                      </div>
                      <button className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                        <Globe className="h-4 w-4 mr-2" />
                        Export Data
                      </button>
                    </div>
                  </div>

                  {/* Delete Account */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-red-900 mb-2">Delete Account</h4>
                        <p className="text-red-800 text-sm mb-4">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                          <p className="text-red-800 text-xs">
                            <strong>Warning:</strong> This will delete all your workouts, performance data, messages, and account information.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={saving}
                        className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? (
                          <>
                            <Loader className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Us Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Contact Us</h3>
              <p className="text-sm text-gray-500 mb-4">
                Have questions or concerns? Reach out and we'll get back to you.
              </p>
              <a
                href="mailto:brian@bowtaifitness.com"
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors touch-manipulation"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileManagement;