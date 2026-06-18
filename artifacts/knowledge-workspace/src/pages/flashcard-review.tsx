import { useState } from "react";
import { useGetFlashcardDeck, useReviewCard } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";

export default function FlashcardReview() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  
  const { data: deck, isLoading } = useGetFlashcardDeck(id!, { query: { enabled: !!id, queryKey: ["/api/flashcards/decks", id] } });
  const reviewCard = useReviewCard();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deck) return <div className="p-8">Deck not found.</div>;

  const dueCards = deck.cards.filter(c => new Date(c.dueAt) <= new Date() || c.reviewCount === 0);
  const currentCard = dueCards[currentIndex];

  const handleReview = async (quality: number) => {
    if (!currentCard) return;
    
    await reviewCard.mutateAsync({ id: currentCard.id, data: { cardId: currentCard.id, quality } });
    
    setIsFlipped(false);
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Done with due cards, refetch to see if any are left (e.g. ones that were rated 0)
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/decks", id] });
      setCurrentIndex(0);
    }
  };

  if (dueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-6 text-primary">
          <RefreshCcw className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
        <p className="text-muted-foreground mb-8">You've reviewed all due cards in this deck.</p>
        <Link href="/flashcards">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Decks</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <Link href="/flashcards">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        </Link>
        <div className="font-mono text-sm font-bold tracking-widest text-muted-foreground">
          {currentIndex + 1} / {dueCards.length}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
        <div 
          className={`w-full aspect-video md:aspect-[2/1] relative cursor-pointer group perspective-1000`}
          onClick={() => !isFlipped && setIsFlipped(true)}
        >
          <div className={`w-full h-full transition-all duration-500 preserve-3d absolute inset-0 ${isFlipped ? 'rotate-y-180' : ''}`}>
            
            {/* Front */}
            <div className="absolute inset-0 backface-hidden bg-card border-2 border-border rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center shadow-xl group-hover:border-primary/50 transition-colors">
              <div className="text-2xl md:text-4xl text-center font-serif leading-tight">
                {currentCard?.front}
              </div>
              {!isFlipped && (
                <div className="absolute bottom-6 text-sm text-muted-foreground font-mono animate-pulse">
                  Click to reveal
                </div>
              )}
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-sidebar border-2 border-primary rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center shadow-2xl overflow-y-auto">
              <div className="text-xl md:text-3xl text-center font-sans leading-relaxed text-foreground whitespace-pre-wrap">
                {currentCard?.back}
              </div>
            </div>

          </div>
        </div>

        <div className={`w-full mt-12 transition-all duration-300 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <div className="grid grid-cols-5 gap-2 w-full max-w-2xl mx-auto">
            <Button variant="outline" className="h-16 flex flex-col gap-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={(e) => { e.stopPropagation(); handleReview(0); }}>
              <span className="text-xs font-mono">0</span>
              <span className="font-bold">Again</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-1" onClick={(e) => { e.stopPropagation(); handleReview(1); }}>
              <span className="text-xs font-mono">1</span>
              <span className="font-bold">Hard</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-1" onClick={(e) => { e.stopPropagation(); handleReview(3); }}>
              <span className="text-xs font-mono">3</span>
              <span className="font-bold">Good</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-1 text-primary border-primary hover:bg-primary hover:text-primary-foreground" onClick={(e) => { e.stopPropagation(); handleReview(4); }}>
              <span className="text-xs font-mono">4</span>
              <span className="font-bold">Easy</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-1 text-accent border-accent hover:bg-accent hover:text-accent-foreground" onClick={(e) => { e.stopPropagation(); handleReview(5); }}>
              <span className="text-xs font-mono">5</span>
              <span className="font-bold">Perfect</span>
            </Button>
          </div>
        </div>
      </div>
      
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
