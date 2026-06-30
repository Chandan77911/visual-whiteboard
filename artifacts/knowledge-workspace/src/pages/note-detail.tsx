import { useState, useRef } from "react";
import {
  useGetNote,
  useUpdateNote,
  useCreateBlock,
  useDeleteBlock,
  useSynthesizeNote,
  useTranscribeAudio,
} from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Trash2,
  Sparkles,
  Mic,
  MicOff,
  Image as ImageIcon,
  Type,
  Loader2,
  ArrowLeft,
  ExternalLink,
  CheckSquare,
  Tag,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_IMAGE_DATA_URL_LENGTH = 90000;
const MAX_IMAGE_DIMENSION = 1400;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Could not process the selected image."));
    image.src = src;
  });
}

async function compressImageFile(file: File): Promise<string> {
  const original = await readFileAsDataUrl(file);
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    if (original.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new Error(
        "That image is too large. Please use a smaller PNG or JPG chart image.",
      );
    }
    return original;
  }

  const image = await loadImage(original);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.width, image.height),
  );
  let width = Math.max(1, Math.round(image.width * scale));
  let height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("Image compression is not supported in this browser.");

  const render = () => {
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
  };

  render();
  let quality = 0.86;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH && quality > 0.46) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  while (
    dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH &&
    Math.max(width, height) > 640
  ) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    render();
    dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  }

  if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error(
      "That image is too large after compression. Crop the chart or upload a smaller image.",
    );
  }

  return dataUrl;
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: note, isLoading } = useGetNote(id!, {
    query: { enabled: !!id, queryKey: ["/api/notes", id] },
  });

  const updateNote = useUpdateNote();
  const createBlock = useCreateBlock();
  const deleteBlock = useDeleteBlock();
  const synthesizeNote = useSynthesizeNote();
  const transcribeAudio = useTranscribeAudio();

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<{
    actionItems?: string[];
    suggestedLinks?: { noteId: string; noteTitle: string; reason: string }[];
    keyThemes?: string[];
  } | null>(null);
  const [newBlockText, setNewBlockText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [blockMode, setBlockMode] = useState<"text" | "voice" | "image">(
    "text",
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading)
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  if (!note)
    return (
      <div className="p-8 flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/notes")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <p className="text-muted-foreground">Note not found.</p>
      </div>
    );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNote.mutate(
      { id: note.id, data: { title: e.target.value } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(["/api/notes", id], (old: any) =>
            old ? { ...old, title: data.title } : old,
          );
        },
      },
    );
  };

  const handleAddTextBlock = async () => {
    if (!newBlockText.trim()) return;
    await createBlock.mutateAsync({
      data: { type: "text", content: newBlockText, noteId: note.id },
    });
    setNewBlockText("");
    queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          try {
            const result = await transcribeAudio.mutateAsync({
              data: { audioBase64: base64Audio, mimeType: "audio/webm" },
            });
            await createBlock.mutateAsync({
              data: {
                type: "voice",
                content: "Voice note",
                transcript: result.transcript,
                noteId: note.id,
              },
            });
            queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
          } catch (e) {
            console.error("Failed to transcribe", e);
          } finally {
            setIsTranscribing(false);
          }
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (e) {
      alert("Microphone access denied. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      await createBlock.mutateAsync({
        data: {
          type: "image",
          content: dataUrl,
          noteId: note.id,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/blocks"] });
    } catch (error: any) {
      alert(error?.message ?? "Failed to upload image.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    setSynthesisResult(null);
    try {
      const result = await synthesizeNote.mutateAsync({
        data: { noteId: note.id },
      });
      setSynthesisResult(result as any);
      queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock.mutateAsync({ id: blockId });
    queryClient.invalidateQueries({ queryKey: ["/api/notes", id] });
  };

  const blockTypeIcons: Record<string, React.ReactNode> = {
    text: <Type className="w-3 h-3" />,
    voice: <Mic className="w-3 h-3" />,
    image: <ImageIcon className="w-3 h-3" />,
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border px-8 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/notes")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Notes
          </Button>
          <div className="flex gap-1 ml-auto">
            {note.tags?.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-8 py-8">
          <Input
            value={note.title}
            onChange={handleTitleChange}
            className="text-4xl font-bold bg-transparent border-none px-0 shadow-none focus-visible:ring-0 mb-2 font-sans h-auto text-foreground"
            placeholder="Untitled Note"
          />

          {note.summary && (
            <p className="text-muted-foreground text-sm mb-8 italic border-l-4 border-primary/30 pl-4">
              {note.summary}
            </p>
          )}

          {/* Blocks */}
          <div className="space-y-4 mb-10">
            {note.blocks?.map((block) => (
              <div
                key={block.id}
                className="group relative bg-card rounded-xl p-4 border border-border hover:border-primary/40 transition-all"
              >
                <div className="absolute top-2 left-3 flex items-center gap-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all">
                  <span className="flex items-center gap-1 text-[10px] font-mono uppercase bg-muted px-1.5 py-0.5 rounded">
                    {blockTypeIcons[block.type]}
                    {block.type}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteBlock(block.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all rounded-md hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {block.type === "text" && (
                  <div className="prose dark:prose-invert max-w-none text-card-foreground whitespace-pre-wrap text-sm leading-relaxed pt-2">
                    {block.content}
                  </div>
                )}

                {block.type === "voice" && (
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mic className="w-3 h-3" />
                      </div>
                      Voice Note
                    </div>
                    {block.transcript && (
                      <p className="text-card-foreground text-sm leading-relaxed italic border-l-2 border-primary/40 pl-4 py-1 bg-primary/5 rounded-r-lg">
                        "{block.transcript}"
                      </p>
                    )}
                    {block.audioUrl && (
                      <audio
                        controls
                        src={block.audioUrl}
                        className="h-8 w-full max-w-md mt-1"
                      />
                    )}
                    {!block.transcript && !block.audioUrl && (
                      <p className="text-muted-foreground text-sm italic">
                        No transcript available.
                      </p>
                    )}
                  </div>
                )}

                {block.type === "image" && block.content && (
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex items-center gap-2 text-chart-3 font-mono text-xs font-bold mb-2">
                      <ImageIcon className="w-3 h-3" /> Image Block
                    </div>
                    <img
                      src={block.content}
                      alt="Uploaded image"
                      className="max-w-full max-h-96 rounded-lg object-contain border border-border"
                    />
                  </div>
                )}
              </div>
            ))}

            {note.blocks?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                <Type className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No blocks yet</p>
                <p className="text-sm mt-1 opacity-70">
                  Use the toolbar below to add text, voice, or image blocks
                </p>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden sticky bottom-8">
            {/* Mode tabs */}
            <div className="flex border-b border-border">
              {(["text", "voice", "image"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBlockMode(mode)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors",
                    blockMode === mode
                      ? "bg-primary/10 text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  )}
                >
                  {mode === "text" && <Type className="w-3.5 h-3.5" />}
                  {mode === "voice" && <Mic className="w-3.5 h-3.5" />}
                  {mode === "image" && <ImageIcon className="w-3.5 h-3.5" />}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {blockMode === "text" && (
              <div className="p-4">
                <Textarea
                  placeholder="Write your thoughts... (Ctrl+Enter to save)"
                  value={newBlockText}
                  onChange={(e) => setNewBlockText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddTextBlock();
                    }
                  }}
                  className="min-h-[80px] bg-background border-none resize-none focus-visible:ring-1 focus-visible:ring-primary font-mono text-sm"
                />
                <div className="flex justify-end mt-3">
                  <Button
                    size="sm"
                    onClick={handleAddTextBlock}
                    disabled={!newBlockText.trim() || createBlock.isPending}
                  >
                    {createBlock.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Add Block
                  </Button>
                </div>
              </div>
            )}

            {blockMode === "voice" && (
              <div className="p-6 flex flex-col items-center gap-4">
                {isTranscribing ? (
                  <div className="flex items-center gap-3 text-primary">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">
                      Transcribing with AI…
                    </span>
                  </div>
                ) : isRecording ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-destructive/20 animate-ping absolute inset-0" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="w-16 h-16 rounded-full relative z-10 shadow-lg"
                        onClick={stopRecording}
                      >
                        <MicOff className="w-6 h-6" />
                      </Button>
                    </div>
                    <p className="text-sm text-destructive font-medium animate-pulse">
                      Recording… Click to stop
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-16 h-16 rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                      onClick={startRecording}
                    >
                      <Mic className="w-6 h-6" />
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Click to start recording
                    </p>
                    <p className="text-xs text-muted-foreground opacity-60">
                      AI will transcribe your voice automatically
                    </p>
                  </div>
                )}
              </div>
            )}

            {blockMode === "image" && (
              <div
                className="p-6 flex flex-col items-center gap-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Click to upload an image
                </p>
                <p className="text-xs text-muted-foreground opacity-60">
                  PNG, JPG, GIF, WebP supported
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-80 border-l border-border bg-sidebar overflow-y-auto shrink-0 flex flex-col">
        <div className="p-5 border-b border-sidebar-border sticky top-0 bg-sidebar/95 backdrop-blur z-10">
          <Button
            className="w-full gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold shadow hover:shadow-lg transition-all"
            onClick={handleSynthesize}
            disabled={
              isSynthesizing || !note.blocks || note.blocks.length === 0
            }
          >
            {isSynthesizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isSynthesizing ? "Synthesizing…" : "Synthesize with AI"}
          </Button>
          {(!note.blocks || note.blocks.length === 0) && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Add blocks first
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* AI Summary */}
          {note.summary && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" /> AI Summary
              </h3>
              <p className="text-sm leading-relaxed text-foreground">
                {note.summary}
              </p>
            </div>
          )}

          {/* Key Themes from synthesis */}
          {synthesisResult?.keyThemes &&
            synthesisResult.keyThemes.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Tag className="w-3 h-3 text-primary" /> Key Themes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {synthesisResult.keyThemes.map((theme) => (
                    <span
                      key={theme}
                      className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-medium"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Stored tags */}
          {note.tags &&
            note.tags.length > 0 &&
            !synthesisResult?.keyThemes?.length && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Tag className="w-3 h-3 text-primary" /> Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-sidebar-accent text-sidebar-accent-foreground px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Action Items */}
          {synthesisResult?.actionItems &&
            synthesisResult.actionItems.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckSquare className="w-3 h-3 text-accent" /> Action Items
                </h3>
                <div className="space-y-2">
                  {synthesisResult.actionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <Square className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
                      <span className="leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Suggested Links */}
          {synthesisResult?.suggestedLinks &&
            synthesisResult.suggestedLinks.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ExternalLink className="w-3 h-3 text-chart-3" /> Suggested
                  Links
                </h3>
                <div className="space-y-2">
                  {synthesisResult.suggestedLinks.map((link) => (
                    <div
                      key={link.noteId}
                      className="p-3 bg-sidebar-accent rounded-lg border border-sidebar-border cursor-pointer hover:border-primary/50 transition-all group"
                      onClick={() => setLocation(`/notes/${link.noteId}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                          {link.noteTitle}
                        </p>
                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {link.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Block stats */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Block Stats
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(["text", "voice", "image"] as const).map((type) => {
                const count =
                  note.blocks?.filter((b) => b.type === type).length ?? 0;
                return (
                  <div
                    key={type}
                    className="bg-sidebar-accent rounded-lg p-2 text-center"
                  >
                    <div className="text-lg font-bold font-mono">{count}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {type}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
