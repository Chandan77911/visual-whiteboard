import { useState } from "react";
import { useListBlocks, useDeleteBlock } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Boxes, Trash2, Search, Type, Mic, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Blocks() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const { data: blocks, isLoading } = useListBlocks({
    search: search || undefined,
    type: typeFilter !== "all" ? typeFilter : undefined
  });
  const deleteBlock = useDeleteBlock();

  const handleDelete = async (id: string) => {
    await deleteBlock.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: ["/api/blocks"] });
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Atomic Blocks</h1>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search all blocks..."
            className="pl-9 bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="voice">Voice</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-20">
        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 bg-card animate-pulse rounded-lg border border-border" />
            ))}
          </div>
        ) : blocks?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Boxes className="w-12 h-12 mb-4 opacity-20" />
            <p>No blocks found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {blocks?.map((block) => (
              <Card key={block.id} className="bg-card border-border hover:border-primary/50 transition-all relative group">
                <button
                  onClick={() => handleDelete(block.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-all rounded-md hover:bg-destructive/10 z-10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <CardContent className="p-5 flex flex-col h-full">
                  {/* Block type badge */}
                  <div className="flex items-center gap-2 mb-3 text-primary font-mono text-xs uppercase tracking-wider">
                    {block.type === 'text' && <Type className="w-4 h-4" />}
                    {block.type === 'voice' && <Mic className="w-4 h-4" />}
                    {block.type === 'image' && <ImageIcon className="w-4 h-4" />}
                    {block.type}
                  </div>

                  {/* ✅ FIX: Render image blocks properly, not as raw base64 text */}
                  {block.type === 'image' ? (
                    <div className="flex-1 mb-4">
                      <img
                        src={block.content}
                        alt="Image block"
                        className="max-h-48 rounded-lg object-contain border border-border w-full"
                      />
                    </div>
                  ) : block.type === 'voice' ? (
                    <div className="flex-1 mb-4">
                      {block.transcript ? (
                        <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3 line-clamp-4">
                          "{block.transcript}"
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No transcript</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 text-sm font-mono whitespace-pre-wrap text-card-foreground mb-4 line-clamp-4">
                      {block.content}
                    </div>
                  )}

                  {block.noteId && (
                    <div className="mt-auto border-t border-border/50 pt-3 flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">From note:</span>
                      <Link href={`/notes/${block.noteId}`}>
                        <span className="text-accent hover:underline cursor-pointer">View Context →</span>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
