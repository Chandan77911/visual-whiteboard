import { useState } from "react";
import { useListNotes, useCreateNote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { FileText, Plus, Search, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export default function Notes() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: notes, isLoading } = useListNotes({ search: search || undefined });
  const createNote = useCreateNote();

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const note = await createNote.mutateAsync({ data: { title: newTitle } });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setIsCreateOpen(false);
      setLocation(`/notes/${note.id}`);
    } catch (e) {
      console.error("Failed to create note", e);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm"><Plus className="w-4 h-4" /> New Note</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Note</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input 
                placeholder="Note title..." 
                value={newTitle} 
                onChange={(e) => setNewTitle(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
                className="text-lg py-6"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || createNote.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search notes..." 
            className="pl-9 bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-20">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-32 bg-card animate-pulse rounded-lg border border-border" />
            ))}
          </div>
        ) : notes?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>No notes found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {notes?.map((note) => (
              <Link key={note.id} href={`/notes/${note.id}`}>
                <div className="group flex flex-col p-5 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                  <h3 className="font-semibold text-lg mb-2 text-foreground group-hover:text-primary transition-colors">{note.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                    {note.summary || "No summary available."}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      {note.tags?.slice(0,2).map(tag => (
                        <span key={tag} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tags className="w-3 h-3" /> {tag}
                        </span>
                      ))}
                      {(note.tags?.length || 0) > 2 && <span className="text-xs text-muted-foreground">+{note.tags!.length - 2}</span>}
                    </div>
                    <span className="text-xs font-mono bg-accent/10 text-accent px-2 py-1 rounded-md">
                      {note.blockCount} blocks
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
