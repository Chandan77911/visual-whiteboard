import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Notes from "@/pages/notes";
import NoteDetail from "@/pages/note-detail";
import Blocks from "@/pages/blocks";
import GraphView from "@/pages/graph";
import Flashcards from "@/pages/flashcards";
import FlashcardReview from "@/pages/flashcard-review";
import MindMaps from "@/pages/mindmaps";
import MindMapDetail from "@/pages/mindmap-detail";
import Chat from "@/pages/chat";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/notes" component={Notes} />
        <Route path="/notes/:id" component={NoteDetail} />
        <Route path="/blocks" component={Blocks} />
        <Route path="/graph" component={GraphView} />
        <Route path="/flashcards" component={Flashcards} />
        <Route path="/flashcards/:id" component={FlashcardReview} />
        <Route path="/mindmaps" component={MindMaps} />
        <Route path="/mindmaps/:id" component={MindMapDetail} />
        <Route path="/chat" component={Chat} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
