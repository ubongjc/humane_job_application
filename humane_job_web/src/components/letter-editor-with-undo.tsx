"use client";

/**
 * 📝 LETTER EDITOR WITH UNDO/REDO
 *
 * Real-world example of undo/redo in the letter editing workflow.
 * Users can confidently edit letters knowing they can always undo mistakes.
 */

import { useState } from "react";
import { useUndoRedo, useUndoRedoForm, UndoRedoToolbar } from "@/hooks/use-undo-redo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface LetterState {
  content: string;
  tone: "formal" | "friendly" | "empathetic";
  recipientName: string;
}

export function LetterEditorWithUndo() {
  const {
    state: letter,
    setState: setLetter,
    undo,
    redo,
    canUndo,
    canRedo,
    historyInfo,
  } = useUndoRedo<LetterState>({
    content: "Dear [Candidate Name],\n\nThank you for your interest...",
    tone: "empathetic",
    recipientName: "John Doe",
  });

  // Update individual fields
  const updateContent = (content: string) => {
    setLetter((prev) => ({ ...prev, content }));
  };

  const updateTone = (tone: LetterState["tone"]) => {
    setLetter((prev) => ({ ...prev, tone }));
  };

  const updateRecipient = (recipientName: string) => {
    setLetter((prev) => ({ ...prev, recipientName }));
  };

  return (
    <Card className="p-6 space-y-4">
      {/* Header with Undo/Redo */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Letter Editor</h3>
          <p className="text-sm text-gray-500">
            {historyInfo.past} changes • Cmd+Z to undo
          </p>
        </div>
        <UndoRedoToolbar
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>

      {/* Recipient */}
      <div>
        <label className="text-sm font-medium">Recipient</label>
        <input
          type="text"
          value={letter.recipientName}
          onChange={(e) => updateRecipient(e.target.value)}
          className="w-full mt-1 px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Tone Selection */}
      <div>
        <label className="text-sm font-medium">Tone</label>
        <Select value={letter.tone} onValueChange={updateTone}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="formal">Formal</SelectItem>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="empathetic">Empathetic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Letter Content */}
      <div>
        <label className="text-sm font-medium">Letter Content</label>
        <Textarea
          value={letter.content}
          onChange={(e) => updateContent(e.target.value)}
          rows={12}
          className="mt-1 font-mono text-sm"
        />
      </div>

      {/* Preview */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-xs text-gray-500 mb-2">Preview</p>
        <div className="prose prose-sm">
          <p className="whitespace-pre-wrap">{letter.content}</p>
        </div>
        <div className="mt-2">
          <Badge variant="outline">{letter.tone}</Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={undo} disabled={!canUndo}>
          Undo Change
        </Button>
        <Button className="flex-1">Send Letter</Button>
      </div>
    </Card>
  );
}

/**
 * 📋 FEEDBACK EDITOR WITH UNDO
 *
 * Edit candidate feedback with full undo/redo support.
 */
interface FeedbackItem {
  id: string;
  criterion: string;
  score: number;
  comment: string;
}

export function FeedbackEditorWithUndo({ initialFeedback }: { initialFeedback: FeedbackItem[] }) {
  const {
    state: feedback,
    setState: setFeedback,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<FeedbackItem[]>(initialFeedback);

  const updateScore = (id: string, score: number) => {
    setFeedback((prev) =>
      prev.map((item) => (item.id === id ? { ...item, score } : item))
    );
  };

  const updateComment = (id: string, comment: string) => {
    setFeedback((prev) =>
      prev.map((item) => (item.id === id ? { ...item, comment } : item))
    );
  };

  const addFeedback = () => {
    setFeedback((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        criterion: "New Criterion",
        score: 3,
        comment: "",
      },
    ]);
  };

  const removeFeedback = (id: string) => {
    setFeedback((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Interview Feedback</h3>
        <UndoRedoToolbar
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>

      <div className="space-y-4">
        {feedback.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={item.criterion}
                onChange={(e) =>
                  setFeedback((prev) =>
                    prev.map((i) =>
                      i.id === item.id ? { ...i, criterion: e.target.value } : i
                    )
                  )
                }
                className="font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFeedback(item.id)}
              >
                Remove
              </Button>
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Score: {item.score}/5
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={item.score}
                onChange={(e) => updateScore(item.id, parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <Textarea
              value={item.comment}
              onChange={(e) => updateComment(item.id, e.target.value)}
              placeholder="Add comments..."
              rows={2}
            />
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={addFeedback} className="w-full">
        + Add Feedback
      </Button>
    </Card>
  );
}

/**
 * 📝 SIMPLE TEXT EDITOR WITH UNDO
 *
 * Debounced undo/redo for smooth typing experience.
 */
export function SimpleTextEditorWithUndo() {
  const {
    state: text,
    setState: setText,
    undo,
    redo,
    canUndo,
    canRedo,
    historyInfo,
  } = useUndoRedoForm("", { debounceMs: 1000 }); // Only add to history after 1s pause

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Notes</h3>
          <p className="text-sm text-gray-500">
            Auto-saves to history after 1 second
          </p>
        </div>
        <UndoRedoToolbar
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start typing... Changes are saved automatically"
        rows={10}
        className="font-mono"
      />

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{text.length} characters</span>
        <span>{historyInfo.past} snapshots in history</span>
      </div>
    </Card>
  );
}

/**
 * 💡 USAGE TIPS:
 *
 * 1. Use `useUndoRedo` for immediate state changes (dropdowns, checkboxes)
 * 2. Use `useUndoRedoForm` for text inputs (debounced to avoid history spam)
 * 3. Always show undo/redo buttons for visibility
 * 4. Display keyboard shortcuts in tooltips
 * 5. Show history count so users know they can undo
 *
 * Result: Users feel confident making changes! No stress about mistakes. ✅
 */
