import { useState } from "react";
import {
  useListMindMaps,
  useCreateMindMap,
  useDeleteMindMap,
  useListNotes,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { BrainCircuit, Plus, Trash2, ArrowRight, Loader2, Sparkles } from "lucide-react";
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

export default function MindMaps() {
  const queryClient = useQueryClient();
  const { data: mindmaps, isLoading } = useListMindMaps();
  const { data: notes } = useListNotes();
  const createMindMap = useCreateMindMap();
  const deleteMindMap = useDeleteMindMap();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [title, setTitle] = useState("");

  const handleCreate = async () => {
    if (!selectedNoteId) return;
    const selectedNote = notes?.find((n) => n.id === selectedNoteId);
    await createMindMap.mutateAsync({
      data: {
        noteId: selectedNoteId,
        title: title || (selectedNote ? `Mind Map: ${selectedNote.title}` : undefined),
      },
    });
    queryClient.invalidateQueries({ queryKey: ["/api/mindmaps"] });
    setIsCreateOpen(false);
    setSelectedNoteId("");
    setTitle("");
  };

  const handleDelete = async (id: string) => {
    await deleteMindMap.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: ["/api/mindmaps"] });
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mind Maps</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-generate visual concept maps from your notes
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Generate Mind Map
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Generate Mind Map
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                  Select a Note
                </label>
                <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a note to map…" />
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
                  placeholder="Leave blank to auto-generate…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              {selectedNoteId && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
                  <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
                  AI will analyze the note's blocks and generate a structured concept map.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedNoteId || createMindMap.isPending}
              >
                {createMindMap.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…
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
              <div key={i} className="h-36 bg-card animate-pulse rounded-xl border border-border" />
            ))}
          </div>
        ) : !mindmaps || mindmaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
            <BrainCircuit className="w-16 h-16 opacity-20" />
            <div className="text-center">
              <p className="font-medium">No mind maps yet</p>
              <p className="text-sm mt-1 opacity-70">
                Generate one from any note to visualize concepts
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 mt-2"
            >
              <Plus className="w-4 h-4" /> Create your first mind map
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mindmaps.map((map) => (
              <Card
                key={map.id}
                className="bg-card border-border relative group flex flex-col hover:border-primary/50 transition-all hover:shadow-lg"
              >
                <button
                  onClick={() => handleDelete(map.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all rounded-md z-10 hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <CardHeader className="pb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <BrainCircuit className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-base text-foreground line-clamp-2 pr-8">
                    {map.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(map.createdAt).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardContent className="mt-auto pt-2">
                  <Link href={`/mindmaps/${map.id}`}>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-border hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                    >
                      Open Map <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
