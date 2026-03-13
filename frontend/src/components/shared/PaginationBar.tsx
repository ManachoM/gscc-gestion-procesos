import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

interface PaginationBarProps {
  skip: number;
  limit: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
}

export function PaginationBar({ skip, limit, count, onPrev, onNext }: PaginationBarProps) {
  const from = count === 0 ? 0 : skip + 1;
  const to = Math.min(skip + limit, skip + count);
  const hasPrev = skip > 0;
  const hasNext = count === limit;

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-500">
        {count === 0 ? "No results" : `Showing ${from}–${to}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronLeft className="size-3.5" />}
          onClick={onPrev}
          disabled={!hasPrev}
        >
          Prev
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
