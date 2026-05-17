import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createBugReport } from "@/lib/api";
import { Bug, Loader2 } from "lucide-react";
import type { BugReportCategory } from "@/types";

const CATEGORIES: { value: BugReportCategory; label: string }[] = [
  { value: "ui_bug", label: "UI Bug" },
  { value: "scan_issue", label: "Scan Issue" },
  { value: "data_incorrect", label: "Incorrect Data" },
  { value: "performance", label: "Performance" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
];

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportModal({ open, onOpenChange }: BugReportModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BugReportCategory | "">("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setScreenshotUrl("");
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !category) return;

    setLoading(true);
    try {
      await createBugReport({
        title: title.trim(),
        description: description.trim(),
        category: category as BugReportCategory,
        screenshotUrl: screenshotUrl.trim() || undefined,
        metadata: {
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        },
      });

      toast({
        title: "Bug report submitted",
        description: "Thank you for your feedback. Our team will review it.",
        type: "success",
      });

      resetForm();
      onOpenChange(false);
    } catch {
      toast({
        title: "Failed to submit bug report",
        description: "Please try again later.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const isValid =
    title.trim().length >= 3 &&
    description.trim().length > 0 &&
    category !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Report a Bug
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting issues you encounter.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label htmlFor="bug-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="bug-title"
              placeholder="Brief summary of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="bug-category" className="text-sm font-medium">
              Category
            </label>
            <Select
              value={category}
              onValueChange={(val) => setCategory(val as BugReportCategory)}
            >
              <SelectTrigger id="bug-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="bug-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="bug-description"
              placeholder="Describe what happened, what you expected, and steps to reproduce"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={4}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="bug-screenshot" className="text-sm font-medium">
              Screenshot URL{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Input
              id="bug-screenshot"
              placeholder="https://..."
              value={screenshotUrl}
              onChange={(e) => setScreenshotUrl(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
