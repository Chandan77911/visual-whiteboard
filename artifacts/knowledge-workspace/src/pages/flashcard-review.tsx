import { useMemo, useState } from "react";
import {
  useCreateFlashcardDeck,
  useDeleteFlashcardDeck,
  useGetFlashcardDeck,
  useReviewCard,
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Sparkles,
} from "lucide-react";

const MIN_USEFUL_QUESTIONS = 8;

function cleanQuestion(front = "") {
  return front
    .replace(/^\[[^\]]+\]\s*\n?/i, "")
    .replace(/^(question|q|front|topic)\s*[:.-]\s*/i, "")
    .trim();
}

function cleanAnswer(back = "") {
  return (
    back
      .split(/\n\n+/)[0]
      ?.replace(/^(answer|a|back)\s*[:.-]\s*/i, "")
      .trim() || "Review the source note for this answer."
  );
}

export default function FlashcardReview() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: deck, isLoading } = useGetFlashcardDeck(id!, {
    query: { enabled: !!id },
  });
  const createDeck = useCreateFlashcardDeck();
  const deleteDeck = useDeleteFlashcardDeck();
  const reviewCard = useReviewCard();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const dueCards = useMemo(
    () =>
      deck?.cards.filter(
        (c) => new Date(c.dueAt) <= new Date() || c.reviewCount === 0,
      ) ?? [],
    [deck],
  );
  const currentCard = dueCards[currentIndex];
  const question = cleanQuestion(currentCard?.front);
  const answer = cleanAnswer(currentCard?.back);
  const reviewedCount = deck
    ? deck.cards.filter((card) => card.reviewCount > 0).length
    : 0;
  const newCount = deck
    ? deck.cards.filter((card) => card.reviewCount === 0).length
    : 0;
  const progress =
    dueCards.length > 0
      ? Math.round(((currentIndex + 1) / dueCards.length) * 100)
      : 100;
  const isLastQuestion = currentIndex >= dueCards.length - 1;
  const isRegenerating = createDeck.isPending || deleteDeck.isPending;

  const handleRegenerate = async () => {
    if (!deck?.noteId || isRegenerating) return;

    const created = await createDeck.mutateAsync({
      data: {
        noteId: deck.noteId,
        title: deck.title,
      },
    });
    await deleteDeck.mutateAsync({ id: deck.id });
    queryClient.invalidateQueries({ queryKey: ["/api/flashcards"] });
    setLocation(`/flashcards/${created.id}`);
  };

  const handleReview = async (quality: number) => {
    if (!currentCard) return;

    await reviewCard.mutateAsync({
      id: currentCard.id,
      data: { cardId: currentCard.id, quality },
    });

    setIsFlipped(false);
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      queryClient.invalidateQueries({ queryKey: [`/api/flashcards/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards"] });
      setCurrentIndex(0);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deck) return <div className="p-8">Deck not found.</div>;

  if (dueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6 text-primary">
          <RefreshCcw className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
        <p className="text-muted-foreground mb-8">
          You've reviewed all due cards in this deck.
        </p>
        <Link href="/flashcards">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Decks
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border flex items-center justify-between gap-4">
        <Link href="/flashcards">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </Link>
        <div className="flex-1 max-w-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span className="line-clamp-1">{deck.title}</span>
            <span className="font-mono whitespace-nowrap">
              Question {currentIndex + 1} / {dueCards.length}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {deck.noteId && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isRegenerating}
            onClick={handleRegenerate}
          >
            {isRegenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Regenerate
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 px-6 pt-5 max-w-4xl mx-auto w-full">
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <Layers className="w-4 h-4 text-primary" />
          <div>
            <div className="font-mono font-bold">{deck.cards.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase">
              Questions
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <Clock className="w-4 h-4 text-accent" />
          <div>
            <div className="font-mono font-bold">{newCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase">
              New
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-chart-3" />
          <div>
            <div className="font-mono font-bold">{reviewedCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase">
              Reviewed
            </div>
          </div>
        </div>
      </div>

      {deck.noteId && deck.cards.length < MIN_USEFUL_QUESTIONS && (
        <div className="max-w-4xl mx-auto w-full px-6 pt-4">
          <div className="border border-primary/25 bg-primary/10 rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              Only {deck.cards.length} questions found.
            </span>
            <Button
              size="sm"
              className="gap-2"
              disabled={isRegenerating}
              onClick={handleRegenerate}
            >
              {isRegenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Regenerate Q/A slides
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
        <div className="w-full max-w-4xl flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider border border-primary/30 bg-primary/10 text-primary rounded-full px-3 py-1">
            {isFlipped ? "Short Answer" : "Question"}
          </span>
          <span className="text-xs text-muted-foreground">
            Slide {isFlipped ? currentIndex * 2 + 2 : currentIndex * 2 + 1} /{" "}
            {dueCards.length * 2}
          </span>
        </div>

        <div
          className="w-full aspect-video md:aspect-[2/1] relative cursor-pointer group perspective-1000"
          onClick={() => !isFlipped && setIsFlipped(true)}
        >
          <div
            className={`w-full h-full transition-all duration-500 preserve-3d absolute inset-0 ${isFlipped ? "rotate-y-180" : ""}`}
          >
            <div className="absolute inset-0 backface-hidden bg-card border-2 border-border rounded-2xl p-7 md:p-10 flex flex-col items-center justify-center shadow-xl group-hover:border-primary/50 transition-colors">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-5">
                Question
              </p>
              <div className="w-full max-h-full overflow-y-auto text-xl md:text-3xl text-center font-serif leading-relaxed whitespace-pre-wrap">
                {question}
              </div>
              {!isFlipped && (
                <div className="absolute bottom-6 text-sm text-muted-foreground font-mono animate-pulse">
                  Click to reveal answer
                </div>
              )}
            </div>

            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-sidebar border-2 border-primary rounded-2xl p-7 md:p-10 flex flex-col items-center justify-center shadow-2xl overflow-y-auto">
              <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-3">
                Short Answer
              </p>
              <div className="max-w-3xl text-lg md:text-2xl font-sans leading-relaxed text-center text-foreground whitespace-pre-wrap">
                {answer}
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reviewCard.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview(0);
                  }}
                >
                  Again
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reviewCard.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview(2);
                  }}
                >
                  Hard
                </Button>
                <Button
                  size="sm"
                  className="gap-2 min-w-36"
                  disabled={reviewCard.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview(4);
                  }}
                >
                  {reviewCard.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  {isLastQuestion ? "Finish" : "Next Question"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reviewCard.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReview(5);
                  }}
                >
                  Easy
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                }}
              >
                <RotateCcw className="w-3 h-3 mr-2" /> Question
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`.perspective-1000 { perspective: 1000px; } .preserve-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; } .rotate-y-180 { transform: rotateY(180deg); }`}</style>
    </div>
  );
}
