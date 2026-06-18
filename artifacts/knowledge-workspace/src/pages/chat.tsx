import { useState, useRef, useEffect } from "react";
import { useChatWithNotes } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader2 } from "lucide-react";

type Message = {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your AI thinking partner. Ask me anything about your notes, blocks, or knowledge graph.' }
  ]);
  const [input, setInput] = useState("");
  
  const chatMutation = useChatWithNotes();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const res = await chatMutation.mutateAsync({ data: { question: userMessage } });
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: res.answer,
        sources: res.sources
      }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error answering that.' }]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background max-w-4xl mx-auto w-full border-x border-border shadow-2xl">
      <div className="p-6 border-b border-border bg-card">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="text-primary w-6 h-6" /> Chat with Knowledge
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Ask questions spanning across all your atomic notes and blocks.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-sidebar/10">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className={`max-w-[80%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-accent text-accent-foreground rounded-tr-sm' 
                  : 'bg-card border border-border shadow-sm rounded-tl-sm text-card-foreground'
              }`}>
                <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</div>
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center mr-1">Sources:</span>
                  {msg.sources.map((src, idx) => (
                    <span key={idx} className="text-[10px] font-mono bg-border text-foreground px-2 py-0.5 rounded border border-border">
                      {src.substring(0, 8)}...
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm rounded-tl-sm flex items-center">
              <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border bg-card">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-3 relative"
        >
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 bg-background border-border h-12 pr-14 text-base focus-visible:ring-primary"
            disabled={chatMutation.isPending}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-1 top-1 h-10 w-10 bg-primary hover:bg-primary/90 transition-transform hover:scale-105"
            disabled={!input.trim() || chatMutation.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
