import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Copy } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: 'trainer' | 'coach';
  token: string;
  invited_by: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export default function InvitationManagement() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'coach' as 'coach' | 'trainer'
  });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
      setMessage({ type: 'error', text: 'Failed to load invitations' });
    } finally {
      setLoading(false);
    }
  };

  const sendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create invitation record
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          email: formData.email,
          role: formData.role,
          invited_by: user.id
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Call edge function to send email
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: formData.email,
          role: formData.role,
          token: invitation.token
        }
      });

      if (emailError) {
        console.error('Email sending failed:', emailError);
        setMessage({
          type: 'success',
          text: 'Invitation created but email sending failed. You can copy the link below.'
        });
      } else {
        setMessage({ type: 'success', text: 'Invitation sent successfully!' });
      }

      setFormData({ email: '', role: 'coach' });
      setShowInviteForm(false);
      await loadInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to send invitation' });
    } finally {
      setSending(false);
    }
  };

  const deleteInvitation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invitation?')) return;

    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Invitation deleted' });
      await loadInvitations();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete invitation' });
    }
  };

  const copyInvitationLink = (token: string, email: string, role: string) => {
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}?invite=${token}&email=${encodeURIComponent(email)}&role=${role}`;
    navigator.clipboard.writeText(inviteUrl);
    setMessage({ type: 'success', text: 'Invitation link copied to clipboard!' });
  };

  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.used_at) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Used
        </span>
      );
    }

    const expiresAt = new Date(invitation.expires_at);
    const now = new Date();

    if (expiresAt < now) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Expired
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trainer & Coach Invitations</h1>
          <p className="text-gray-600 mt-1">Manage invitations for new trainers and coaches</p>
        </div>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Mail className="w-5 h-5 mr-2" />
          Send Invitation
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {showInviteForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Send New Invitation</h2>
          <form onSubmit={sendInvitation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'coach' | 'trainer' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="coach">Coach</option>
                <option value="trainer">Trainer</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={sending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No invitations sent yet
                  </td>
                </tr>
              ) : (
                invitations.map((invitation) => (
                  <tr key={invitation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invitation.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                      {invitation.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(invitation)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {!invitation.used_at && new Date(invitation.expires_at) > new Date() && (
                          <button
                            onClick={() => copyInvitationLink(invitation.token, invitation.email, invitation.role)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Copy invitation link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteInvitation(invitation.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete invitation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
