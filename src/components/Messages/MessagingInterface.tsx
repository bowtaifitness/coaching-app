import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  MessageCircle,
  Send,
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  X,
  Download,
  FileText,
  Image as ImageIcon,
  ArrowLeft,
  Inbox,
  Mail,
  MailOpen
} from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  read: boolean;
  payload?: {
    attachments?: Array<{
      name: string;
      url: string;
      type: string;
      size: number;
    }>;
  };
  sender?: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface Conversation {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

const MessagingInterface: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageFilter, setMessageFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const emojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
    '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
    '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
    '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '💪', '🔥', '✨',
    '⭐', '🎉', '🎊', '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤'
  ];

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      let profiles;
      
      if (user.role === 'coach' || user.role === 'admin') {
        // Coaches and admins can message all clients
        const { data: clientProfiles, error: clientsError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, created_at')
          .eq('role', 'client');
        
        if (clientsError) throw clientsError;
        profiles = clientProfiles;
      } else {
        // Clients can message their assigned coach/admin
        console.log('Client looking for assigned coach, user ID:', user.id);
        
        // First get the coach assignment
        const { data: assignment, error: assignmentError } = await supabase
          .from('coach_client_assignments')
          .select(`
            coach_id,
            coach:profiles!coach_client_assignments_coach_id_fkey(id, first_name, last_name, avatar_url, created_at)
          `)
          .eq('client_id', user.id)
          .eq('active', true)
          .maybeSingle();
        
        console.log('Coach assignment query result:', { assignment, error: assignmentError });
        
        if (assignmentError || !assignment) {
          console.error('Error fetching coach assignment:', assignmentError);
          console.log('No assignment found, setting empty profiles array');
          profiles = [];
        } else {
          // Extract coach profiles from assignments
          console.log('Assignment found, coach profile:', assignment.coach);
          
          const coachProfile = assignment.coach;
          
          if (!coachProfile) {
            console.warn('No coach profile found in assignment');
            profiles = [];
          } else {
            console.log('Coach profile found:', coachProfile);
            profiles = [coachProfile];
          }
        }
      }
      
      
      // For each profile, get the latest message and unread count
      const conversationsWithMessages = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Get latest message between user and this profile
          const { data: latestMessage } = await supabase
            .from('messages')
            .select('content, created_at')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          // Get unread count (messages sent to user that are unread)
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', profile.id)
            .eq('receiver_id', user.id)
            .eq('read', false);
          
          return {
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
            lastMessage: latestMessage?.content || 'No messages yet',
            lastMessageTime: latestMessage ? formatTimeAgo(latestMessage.created_at) : 'Never',
            unreadCount: unreadCount || 0
          };
        })
      );
      
      // Sort by unread count first, then by last message time
      conversationsWithMessages.sort((a, b) => {
        if (a.unreadCount !== b.unreadCount) {
          return b.unreadCount - a.unreadCount;
        }
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      setConversations(conversationsWithMessages);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    if (!user) return;
    
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(first_name, last_name, avatar_url)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${conversationId}),and(sender_id.eq.${conversationId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      setMessages(messagesData || []);
      
      // Mark messages as read when viewing conversation
      if (messagesData && messagesData.length > 0) {
        const unreadMessageIds = messagesData
          .filter(msg => msg.sender_id === conversationId && !msg.read)
          .map(msg => msg.id);
        
        if (unreadMessageIds.length > 0) {
          await supabase
            .from('messages')
            .update({ read: true })
            .in('id', unreadMessageIds);
          
          // Refresh conversations to update unread counts
          fetchConversations();
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const { validateAttachmentFile, MAX_TOTAL_ATTACHMENT_BYTES } = await import('../../lib/mediaValidation');
    const accepted: File[] = [];
    const rejected: string[] = [];
    let runningTotal = attachments.reduce((sum, f) => sum + f.size, 0);
    for (const file of Array.from(files)) {
      const v = validateAttachmentFile(file);
      if (!v.ok) {
        rejected.push(v.error ?? `${file.name}: invalid file.`);
        continue;
      }
      if (runningTotal + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
        rejected.push(`${file.name}: total attachment size limit reached.`);
        continue;
      }
      runningTotal += file.size;
      accepted.push(file);
    }
    if (accepted.length > 0) setAttachments(prev => [...prev, ...accepted]);
    if (rejected.length > 0) alert(rejected.join('\n'));
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (files: File[]) => {
    const { validateAttachmentFile, safeExtensionFor, safeRandomId, sanitizeDisplayName, magicBytesMatch } =
      await import('../../lib/mediaValidation');
    const uploadedFiles = [];

    for (const file of files) {
      const v = validateAttachmentFile(file);
      if (!v.ok) {
        console.warn('[uploadAttachments] rejected:', v.error);
        continue;
      }
      if (file.type.startsWith('image/') && !(await magicBytesMatch(file, 'image'))) {
        console.warn('[uploadAttachments] image magic bytes mismatch:', file.name);
        continue;
      }
      const ext = safeExtensionFor(file.type);
      const fileName = `${safeRandomId()}.${ext}`;
      const filePath = `message-attachments/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      uploadedFiles.push({
        name: sanitizeDisplayName(file.name),
        url: urlData.publicUrl,
        type: file.type,
        size: file.size
      });
    }

    return uploadedFiles;
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && attachments.length === 0) || !selectedConversation) return;

    // Validate user is logged in
    if (!user || !user.id) {
      console.error('User not authenticated');
      alert('You must be logged in to send messages.');
      return;
    }

    const messageContent = newMessage.trim();

    try {
      setSending(true);
      setUploading(attachments.length > 0);

      let payload = null;
      if (attachments.length > 0) {
        const uploadedFiles = await uploadAttachments(attachments);
        payload = { attachments: uploadedFiles };
      }

      console.log('Sending message:', {
        content: messageContent || '📎 Attachment',
        sender_id: user.id,
        receiver_id: selectedConversation
      });

      // Prepare message data - only include payload if it exists and is not null
      const messageData: any = {
        content: messageContent || '📎 Attachment',
        sender_id: user.id,
        receiver_id: selectedConversation,
        read: false
      };

      // Only add payload if attachments exist
      if (payload && payload.attachments && payload.attachments.length > 0) {
        messageData.payload = payload;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select(`
          *,
          sender:profiles!sender_id(first_name, last_name, avatar_url)
        `)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from message insert');
      }

      console.log('Message sent successfully:', data);

      setMessages(prev => [...prev, data]);
      setNewMessage('');
      setAttachments([]);

      // Refresh conversations to update last message
      fetchConversations();

    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage = error?.message || 'Failed to send message. Please try again.';
      alert(errorMessage);
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  };


  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = `${conv.first_name} ${conv.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

    if (messageFilter === 'unread') {
      return matchesSearch && conv.unreadCount > 0;
    } else if (messageFilter === 'read') {
      return matchesSearch && conv.unreadCount === 0;
    }

    return matchesSearch;
  });

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 h-full flex flex-col overflow-hidden">
      <div className={`mb-4 sm:mb-6 flex-shrink-0 ${selectedConversation ? 'hidden md:block' : ''}`}>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Messages</h1>
        <p className="text-sm sm:text-base text-gray-600">Communicate with your {user?.role === 'coach' ? 'clients' : 'coach'} in real-time.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full flex-1 min-h-0">
        <div className="flex h-full">
          {/* Conversations List */}
          <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-gray-100 flex-col`}>
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="relative">
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Filter Tabs */}
              {(user?.role === 'coach' || user?.role === 'admin') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setMessageFilter('all')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      messageFilter === 'all'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Inbox className="h-4 w-4" />
                    All
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      messageFilter === 'all' ? 'bg-green-600' : 'bg-gray-200'
                    }`}>
                      {conversations.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setMessageFilter('unread')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      messageFilter === 'unread'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    Unread
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      messageFilter === 'unread' ? 'bg-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {conversations.filter(c => c.unreadCount > 0).length}
                    </span>
                  </button>
                  <button
                    onClick={() => setMessageFilter('read')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      messageFilter === 'read'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <MailOpen className="h-4 w-4" />
                    Read
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      messageFilter === 'read' ? 'bg-green-600' : 'bg-gray-200'
                    }`}>
                      {conversations.filter(c => c.unreadCount === 0).length}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation.id)}
                    className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedConversation === conversation.id ? 'bg-green-50 border-green-200' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="h-12 w-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {conversation.first_name[0]}{conversation.last_name[0]}
                          </span>
                        </div>
                        {conversation.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">{conversation.unreadCount}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {conversation.first_name} {conversation.last_name}
                        </p>
                        <p className="text-sm text-gray-600 truncate">{conversation.lastMessage}</p>
                        <p className="text-xs text-gray-500">{conversation.lastMessageTime}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <MessageCircle className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-gray-600 font-medium mb-1">
                    {messageFilter === 'unread' && 'No unread messages'}
                    {messageFilter === 'read' && 'No read messages'}
                    {messageFilter === 'all' && searchTerm && 'No conversations found'}
                    {messageFilter === 'all' && !searchTerm && 'No conversations yet'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {messageFilter === 'unread' && "You're all caught up!"}
                    {messageFilter === 'read' && 'No messages have been read yet'}
                    {messageFilter === 'all' && searchTerm && 'Try a different search term'}
                    {messageFilter === 'all' && !searchTerm && 'Start a conversation with a client'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col w-full md:w-auto`}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                    {/* Back button for mobile */}
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    >
                      <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm sm:text-base font-semibold">
                        {selectedConv?.first_name[0]}{selectedConv?.last_name[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                        {selectedConv?.first_name} {selectedConv?.last_name}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">
                        {selectedConv?.lastMessageTime && selectedConv.lastMessageTime !== 'Never'
                          ? `Last seen ${selectedConv.lastMessageTime}`
                          : 'No recent activity'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowChatMenu(!showChatMenu)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      
                      {showChatMenu && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowChatMenu(false)}
                          />
                          <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px]">
                            <button
                              onClick={() => {
                                setShowChatMenu(false);
                                // Clear conversation
                                setSelectedConversation(null);
                                setMessages([]);
                              }}
                              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              Clear Chat
                            </button>
                            <button
                              onClick={() => {
                                setShowChatMenu(false);
                                // Mark all messages as read
                                if (messages.length > 0) {
                                  const unreadIds = messages
                                    .filter(msg => msg.sender_id === selectedConversation && !msg.read)
                                    .map(msg => msg.id);
                                  if (unreadIds.length > 0) {
                                    supabase
                                      .from('messages')
                                      .update({ read: true })
                                      .in('id', unreadIds)
                                      .then(() => fetchConversations());
                                  }
                                }
                              }}
                              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              Mark as Read
                            </button>
                            <button
                              onClick={() => {
                                setShowChatMenu(false);
                                // Archive conversation (placeholder)
                                alert('Archive conversation feature coming soon!');
                              }}
                              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              Archive Chat
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {messages.map((message) => {
                    const isOwn = message.sender_id === user?.id;
                    const hasAttachments = message.payload?.attachments && message.payload.attachments.length > 0;

                    return (
                      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-lg ${
                          isOwn
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          {message.content && message.content !== '📎 Attachment' && (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          )}

                          {hasAttachments && (
                            <div className="mt-2 space-y-2">
                              {message.payload!.attachments!.map((attachment, idx) => {
                                const isImage = attachment.type.startsWith('image/');

                                return (
                                  <div key={idx} className={`rounded overflow-hidden ${isOwn ? 'bg-green-600' : 'bg-white'}`}>
                                    {isImage ? (
                                      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={attachment.url}
                                          alt={attachment.name}
                                          className="max-w-full h-auto rounded"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center space-x-2 p-2 hover:opacity-80 ${
                                          isOwn ? 'text-white' : 'text-gray-700'
                                        }`}
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span className="text-xs truncate flex-1">{attachment.name}</span>
                                        <Download className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className={`flex items-center justify-end mt-1 space-x-1 ${
                            isOwn ? 'text-green-100' : 'text-gray-500'
                          }`}>
                            <span className="text-xs">
                              {new Date(message.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {isOwn && (
                              message.read ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No messages yet</p>
                        <p className="text-sm text-gray-400">Start the conversation below</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <div className="p-3 sm:p-4 border-t border-gray-100">
                  {/* Attachment Preview */}
                  {attachments.length > 0 && (
                    <div className="mb-2 sm:mb-3 flex flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="relative bg-gray-100 rounded-lg p-2 pr-8">
                          <div className="flex items-center space-x-2">
                            {file.type.startsWith('image/') ? (
                              <ImageIcon className="h-4 w-4 text-gray-600" />
                            ) : (
                              <FileText className="h-4 w-4 text-gray-600" />
                            )}
                            <span className="text-xs text-gray-700 truncate max-w-[150px]">
                              {file.name}
                            </span>
                          </div>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="absolute -top-1 -right-1 p-2 hover:bg-gray-200 rounded-full"
                          >
                            <X className="h-3 w-3 text-gray-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1 sm:gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 touch-manipulation"
                      disabled={uploading}
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>

                    <div className="flex-1 relative min-w-0">
                      <input
                        ref={messageInputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder={`Message ${selectedConv?.first_name}...`}
                        disabled={sending || uploading}
                        className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
                      >
                        <Smile className="h-5 w-5" />
                      </button>

                      {/* Emoji Picker */}
                      {showEmojiPicker && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-64 max-h-64 overflow-y-auto z-50"
                        >
                          <div className="grid grid-cols-8 gap-1">
                            {emojis.map((emoji, index) => (
                              <button
                                key={index}
                                onClick={() => handleEmojiSelect(emoji)}
                                className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={sendMessage}
                      disabled={sending || uploading || (!newMessage.trim() && attachments.length === 0)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 touch-manipulation"
                    >
                      {sending || uploading ? (
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                  <p className="text-gray-600">Choose a {user?.role === 'coach' ? 'client' : 'coach'} to start messaging.</p>
                  {conversations.length === 0 && !loading && (
                    <p className="text-sm text-gray-500 mt-2">
                      No {user?.role === 'coach' ? 'clients' : 'coaches'} available to message yet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagingInterface;