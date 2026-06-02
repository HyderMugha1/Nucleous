import { useEffect, useState } from "react";
import { getLatestChatbotConversation, sendChatbotMessage, type ChatbotConversationMessage } from "@/lib/api";

function toUiMessages(messages: ChatbotConversationMessage[] | undefined, fallback: string) {
  if (!messages || messages.length === 0) {
    return [{ role: "assistant" as const, content: fallback }];
  }

  return messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export function useContextChatbot({
  contextType,
  fallbackAssistantMessage,
}: {
  contextType: "dashboard" | "report";
  fallbackAssistantMessage: string;
}) {
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; content: string }>>([
    { role: "assistant", content: fallbackAssistantMessage },
  ]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadConversation = async () => {
      try {
        setLoadingHistory(true);
        const response = await getLatestChatbotConversation(contextType);
        if (!active) return;

        if (response.conversation) {
          setConversationId(response.conversation._id);
          setMessages(toUiMessages(response.conversation.messages, fallbackAssistantMessage));
        } else {
          setConversationId(undefined);
          setMessages([{ role: "assistant", content: fallbackAssistantMessage }]);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load chatbot history");
      } finally {
        if (active) setLoadingHistory(false);
      }
    };

    loadConversation();

    return () => {
      active = false;
    };
  }, [contextType, fallbackAssistantMessage]);

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    const previousMessages = messages;
    const optimisticMessages = [...previousMessages, { role: "user" as const, content: trimmed }];
    setMessages(optimisticMessages);
    setSending(true);
    setError("");

    try {
      const response = await sendChatbotMessage({
        contextType,
        message: trimmed,
        conversationId,
      });

      setConversationId(response.conversation._id);
      setMessages(toUiMessages(response.conversation.messages, fallbackAssistantMessage));
    } catch (err) {
      setMessages(previousMessages);
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setSending(false);
    }
  };

  return {
    conversationId,
    messages,
    loadingHistory,
    sending,
    error,
    sendMessage,
  };
}
