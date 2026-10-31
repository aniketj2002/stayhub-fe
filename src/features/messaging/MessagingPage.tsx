import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from './api';
import { useMessagingSocket } from './socket';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';

interface MessagingPageProps {
  isHost?: boolean;
}

export function MessagingPage({ isHost = false }: MessagingPageProps) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { data: conversations = [], isLoading } = useConversations();
  useMessagingSocket(conversationId);

  // If conversationId is not in URL, pick the first one if available (on desktop)
  const selectedId = conversationId || (conversations.length > 0 ? conversations[0].id : null);

  const handleSelect = (id: string) => {
    const basePath = isHost ? '/host/messages' : '/messages';
    navigate(`${basePath}/${id}`);
  };

  const handleBackToList = () => {
    const basePath = isHost ? '/host/messages' : '/messages';
    navigate(basePath);
  };

  return (
    <div className={`messaging-page-container ${isHost ? 'messaging-page--host' : 'messaging-page--guest'}`}>
      <div className={`messaging-split-layout ${conversationId ? 'has-active-thread' : ''}`}>
        {/* Left Column: List */}
        <div className="messaging-sidebar-col">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={handleSelect}
            isLoading={isLoading}
            isHost={isHost}
          />
        </div>

        {/* Right Column: Thread */}
        <div className="messaging-thread-col">
          {selectedId ? (
            <MessageThread
              conversationId={selectedId}
              onBack={handleBackToList}
              isHost={isHost}
            />
          ) : (
            <div className="messaging-thread-placeholder">
              <div className="placeholder-icon-ring" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>Select a conversation</h3>
              <p className="muted-text">
                Choose a conversation from the left to read messages and reply.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
