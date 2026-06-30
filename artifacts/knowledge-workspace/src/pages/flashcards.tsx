import { useState } from "react";
import {
  useListFlashcardDecks,
  useCreateFlashcardDeck,
  useDeleteFlashcardDeck,
  useListNotes,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layers, Plus, Trash2, Play, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Flashcards() {
  const queryClient = useQueryClient();
  const { data: decks, isLoading } = useListFlashcardDecks();
  const { data: notes } = useListNotes();
  const createDeck = useCreateFlashcardDeck();
  const deleteDeck = useDeleteFlashcardDeck();
  const [, setLocation] = useLocation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [deckTitle, setDeckTitle] = useState("");

  const handleCreate = async () => {
    if (!selectedNoteId) return;
    const note = notes?.find((n) => n.id === selectedNoteId);
    const created = await createDeck.mutateAsync({
      data: {
        noteId: selectedNoteId,
        title: deckTitle || (note ? `${note.title} - Flashcards` : undefined),
      },
    });
    queryClient.invalidateQueries({ queryKey: ["/api/flashcards"] });
    setIsCreateOpen(false);
    setSelectedNoteId("");
    setDeckTitle("");
    setLocation(`/flashcards/${created.id}`);
  };

  const handleDelete = async (id: string) => {
    await deleteDeck.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: ["/api/flashcards"] });
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-generated spaced-repetition decks from your notes
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Generate Deck
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Generate Flashcard Deck
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Select a Note
                </label>
                <Select
                  value={selectedNoteId}
                  onValueChange={setSelectedNoteId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a noteâ€¦" />
                  </SelectTrigger>
                  <SelectContent>
                    {notes?.map((note) => (
                      <SelectItem key={note.id} value={note.id}>
                        <div className="flex items-center gap-2">
                          <span>{note.title}</span>
                          <span className="text-xs text-muted-foreground">
                            ({note.blockCount} blocks)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Custom Title (optional)
                </label>
                <Input
                  placeholder="Leave blank to auto-generateâ€¦"
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                />
              </div>
              {selectedNoteId && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
                  <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
                  AI will extract key concepts and generate question-answer
                  pairs using spaced-repetition scheduling.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedNoteId || createDeck.isPending}
              >
                {createDeck.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                    Generatingâ€¦
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" /> Generate
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-20">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 bg-card animate-pulse rounded-xl border border-border"
              />
            ))}
          </div>
        ) : !decks || decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
            <Layers className="w-16 h-16 opacity-20" />
            <div className="text-center">
              <p className="font-medium">No decks yet</p>
              <p className="text-sm mt-1 opacity-70">
                Generate flashcards from any note with AI
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 mt-2"
            >
              <Plus className="w-4 h-4" /> Create your first deck
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map((deck) => (
              <Card
                key={deck.id}
                className="bg-card border-border relative group flex flex-col hover:border-primary/50 transition-all hover:shadow-lg"
              >
                <button
                  onClick={() => handleDelete(deck.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all rounded-md z-10 hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Layers className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-base text-foreground line-clamp-2 pr-8">
                    {deck.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="text-center">
                      <div className="text-3xl font-bold font-mono text-primary">
                        {deck.dueCount}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
                        Due
                      </div>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="text-center">
                      <div className="text-3xl font-bold font-mono">
                        {deck.cardCount}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
                        Total
                      </div>
                    </div>
                    {deck.dueCount > 0 && (
                      <>
                        <div className="w-px h-10 bg-border" />
                        <div className="text-center">
                          <div className="text-3xl font-bold font-mono text-accent">
                            {deck.cardCount - deck.dueCount}
                          </div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
                            Done
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Progress bar */}
                  {deck.cardCount > 0 && (
                    <div className="mb-4">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.round(((deck.cardCount - deck.dueCount) / deck.cardCount) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round(
                          ((deck.cardCount - deck.dueCount) / deck.cardCount) *
                            100,
                        )}
                        % reviewed
                      </p>
                    </div>
                  )}

                  <div className="mt-auto">
                    <Link href={`/flashcards/${deck.id}`}>
                      <Button
                        className={`w-full gap-2 ${
                          deck.dueCount > 0
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                        }`}
                      >
                        <Play className="w-4 h-4" />
                        {deck.dueCount > 0
                          ? `Review ${deck.dueCount} due card${deck.dueCount !== 1 ? "s" : ""}`
                          : "View Deck"}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
