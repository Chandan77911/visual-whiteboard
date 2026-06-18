import { useGetSummary, useListNotes, useListMindMaps, useListFlashcardDecks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, Boxes, Layers, BrainCircuit, Network, MessageSquare,
  Mic, Image as ImageIcon, Plus, ArrowRight, Sparkles, Clock,
  TrendingUp, Zap, BookOpen, Target, Activity
} from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetSummary();
  const { data: notes, isLoading: notesLoading } = useListNotes();
  const { data: mindmaps } = useListMindMaps();
  const { data: decks } = useListFlashcardDecks();

  const isLoading = summaryLoading || notesLoading;

  if (isLoading) {
    return (
      <div className="p-8 h-full overflow-y-auto space-y-8">
        <div className="h-9 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 bg-card animate-pulse rounded-xl border border-border" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-2 h-80 bg-card animate-pulse rounded-xl border border-border" />
          <div className="h-80 bg-card animate-pulse rounded-xl border border-border" />
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Notes",
      value: summary?.totalNotes ?? 0,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
      href: "/notes",
      delta: "+2 this week",
    },
    {
      label: "Knowledge Blocks",
      value: summary?.totalBlocks ?? 0,
      icon: Boxes,
      color: "text-accent",
      bg: "bg-accent/10",
      href: "/blocks",
      delta: "across all notes",
    },
    {
      label: "Flashcard Decks",
      value: summary?.totalFlashcardDecks ?? 0,
      icon: Layers,
      color: "text-chart-3",
      bg: "bg-chart-3/10",
      href: "/flashcards",
      delta: decks && decks.length > 0 ? `${decks.reduce((a, d: any) => a + (d.cardCount ?? 0), 0)} total cards` : "ready to review",
    },
    {
      label: "Mind Maps",
      value: summary?.totalMindMaps ?? 0,
      icon: BrainCircuit,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
      href: "/mindmaps",
      delta: "concept graphs",
    },
  ];

  const blockBreakdown = summary?.blocksByType ?? {};
  const totalBlocks = Object.values(blockBreakdown).reduce((a, b) => a + (b as number), 0);

  const quickActions = [
    { label: "New Note", icon: Plus, href: "/notes", color: "bg-primary text-primary-foreground", desc: "Start capturing ideas" },
    { label: "Voice Record", icon: Mic, href: "/notes", color: "bg-accent text-accent-foreground", desc: "Record & transcribe" },
    { label: "AI Chat", icon: MessageSquare, href: "/chat", color: "bg-chart-3/20 text-chart-3 border border-chart-3/30", desc: "Ask your knowledge base" },
    { label: "Knowledge Graph", icon: Network, href: "/graph", color: "bg-chart-4/20 text-chart-4 border border-chart-4/30", desc: "See connections" },
  ];

  const features = [
    { icon: Mic, label: "Voice Capture", desc: "Record and AI-transcribe", href: "/notes" },
    { icon: ImageIcon, label: "Image Blocks", desc: "Screenshot & photos", href: "/notes" },
    { icon: Sparkles, label: "AI Synthesis", desc: "Extract insights from notes", href: "/notes" },
    { icon: Network, label: "Knowledge Graph", desc: "Visualize connections", href: "/graph" },
    { icon: Layers, label: "Flashcards", desc: "Spaced repetition study", href: "/flashcards" },
    { icon: BrainCircuit, label: "Mind Maps", desc: "Auto-generate concept maps", href: "/mindmaps" },
    { icon: MessageSquare, label: "AI Chat", desc: "Chat with your notes", href: "/chat" },
    { icon: Boxes, label: "Atomic Blocks", desc: "Browse all knowledge cards", href: "/blocks" },
  ];

  return (
    <div className="p-8 h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Command Center</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your AI-powered second brain — capture, connect, and recall anything
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="border-border bg-card hover:border-primary/40 transition-all cursor-pointer hover:shadow-md group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                </div>
                <div className="text-3xl font-bold font-mono mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-foreground">{stat.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.delta}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Notes */}
        <Card className="col-span-2 border-border bg-card">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Recent Notes
              </CardTitle>
            </div>
            <Link href="/notes">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 h-7">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary?.recentNotes && summary.recentNotes.length > 0 ? (
                summary.recentNotes.map((note) => (
                  <Link key={note.id} href={`/notes/${note.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                          {note.title}
                        </h3>
                        {note.summary && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{note.summary}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                          {note.blockCount} blocks
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No notes yet.</p>
                  <Link href="/notes">
                    <Button variant="outline" size="sm" className="mt-3 gap-2">
                      <Plus className="w-4 h-4" /> Create your first note
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Block Breakdown */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Block Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalBlocks > 0 ? (
                <div className="space-y-3">
                  {Object.entries(blockBreakdown).map(([type, count]) => {
                    const pct = Math.round(((count as number) / totalBlocks) * 100);
                    const colors: Record<string, string> = {
                      text: "bg-primary",
                      voice: "bg-accent",
                      image: "bg-chart-3",
                    };
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize text-muted-foreground font-medium">{type}</span>
                          <span className="font-mono font-bold">{count as number}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[type] ?? "bg-primary"} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">No blocks yet.</p>
              )}
            </CardContent>
          </Card>

          {/* AI Features promo */}
          <Card className="border-border bg-gradient-to-br from-primary/10 via-card to-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { icon: Sparkles, text: "Synthesize & extract insights" },
                  { icon: Mic, text: "Voice transcription (Whisper)" },
                  { icon: MessageSquare, text: "Chat with your notes (GPT-4o)" },
                  { icon: BrainCircuit, text: "Auto-generate mind maps" },
                  { icon: Layers, text: "AI flashcard generation" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <item.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                    {item.text}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" /> Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <div className={`p-4 rounded-xl ${action.color} cursor-pointer hover:opacity-90 transition-all hover:scale-[1.02] shadow-sm`}>
                <action.icon className="w-5 h-5 mb-2" />
                <div className="font-semibold text-sm">{action.label}</div>
                <div className="text-xs opacity-75 mt-0.5">{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* All Features */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Target className="w-3.5 h-3.5" /> All Features
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {features.map((f) => (
            <Link key={f.label} href={f.href}>
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors">{f.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{f.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Knowledge Health */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" /> Knowledge Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-lg font-bold font-mono">{notes?.filter(n => n.summary).length ?? 0} / {notes?.length ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Notes synthesized with AI</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Network className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <div className="text-lg font-bold font-mono">{mindmaps?.length ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Mind maps generated</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <div className="text-lg font-bold font-mono">
                    {decks?.reduce((a, d: any) => a + (d.cardCount ?? 0), 0) ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Flashcards created</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
