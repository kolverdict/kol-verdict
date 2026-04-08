"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/ui";
import { useWalletSession } from "@/components/wallet-session-provider";
import { parseApiResponse, toUserFacingApiError } from "@/lib/api-client";
import type { AttachEvidenceResponse, CreateCommentRequest, CreateCommentResponse } from "@/lib/types/api";
import type { CommentView } from "@/lib/types/domain";
import { cx } from "@/lib/utils";

type VerifyClaimModalProps = {
  open: boolean;
  onClose: () => void;
  kolSlug: string;
  feeAmount: string;
  onCommentCreated?: (comment: CommentView) => void;
};

type VerifyClaimDialogProps = Omit<VerifyClaimModalProps, "open">;

const classificationTags = ["Rug", "Shill", "Good Calls", "Alpha", "Scam", "Inactive"] as const;
const evidenceModes = [
  {
    value: "image",
    label: "Image",
    icon: "image",
    placeholder: "Attach screenshot or chart proof",
    helper: "Upload a screenshot, chart, or receipt that supports your verdict.",
  },
  {
    value: "tweet",
    label: "Tweet",
    icon: "link",
    placeholder: "https://x.com/.../status/123",
    helper: "Paste the original tweet or thread URL.",
  },
  {
    value: "tx",
    label: "TX Hash",
    icon: "database",
    placeholder: "Paste a Solscan URL or raw transaction hash",
    helper: "Raw hashes are converted into a Solscan link automatically.",
  },
  {
    value: "link",
    label: "Link",
    icon: "attachment",
    placeholder: "https://...",
    helper: "Attach any public reference link or supporting page.",
  },
] as const;

type EvidenceMode = (typeof evidenceModes)[number]["value"];

type SubmissionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type PreparedEvidence =
  | {
      type: "image";
      file: File;
      metadata: Record<string, unknown>;
    }
  | {
      type: "tweet" | "tx" | "link";
      url: string;
      metadata: Record<string, unknown>;
    };

function tagTone(tag: (typeof classificationTags)[number], selected: boolean) {
  if (selected) {
    return "border-primary/20 bg-primary/5 text-primary";
  }

  if (tag === "Rug" || tag === "Scam") {
    return "border-outline-variant/10 bg-surface-container-low text-on-surface-variant hover:border-tertiary/40 hover:bg-tertiary/10 hover:text-tertiary";
  }

  return "border-outline-variant/10 bg-surface-container-low text-on-surface-variant hover:border-white/15 hover:bg-surface-bright";
}

function evidenceIcon(type: AttachEvidenceResponse["type"]) {
  if (type === "tweet") return "link";
  if (type === "tx") return "database";
  if (type === "image") return "image";
  return "attachment";
}

function evidenceLabel(type: AttachEvidenceResponse["type"]) {
  if (type === "tweet") return "View Tweet";
  if (type === "tx") return "TX Hash";
  if (type === "image") return "View Proof";
  return "Open Link";
}

function mergeCommentEvidence(
  comment: CommentView,
  evidence: AttachEvidenceResponse,
  metadata: Record<string, unknown>,
): CommentView {
  return {
    ...comment,
    evidence: [
      {
        id: evidence.evidenceId,
        type: evidence.type,
        url: evidence.url,
        storageKey: evidence.storageKey,
        metadata,
      },
      ...comment.evidence.filter((entry) => entry.id !== evidence.evidenceId),
    ],
    actions: [
      {
        icon: evidenceIcon(evidence.type),
        label: evidenceLabel(evidence.type),
        tone: "secondary",
        href: evidence.url,
      },
      ...comment.actions.filter((action) => action.href !== evidence.url && action.label !== "Evidence"),
    ],
  };
}

function getEvidenceModeMeta(mode: EvidenceMode) {
  return evidenceModes.find((entry) => entry.value === mode)!;
}

function normalizeUrl(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    throw new Error("Enter a valid public URL.");
  }
}

function prepareEvidence(mode: EvidenceMode, selectedFile: File | null, evidenceValue: string): PreparedEvidence | null {
  if (mode === "image") {
    if (!selectedFile) {
      return null;
    }

    return {
      type: "image",
      file: selectedFile,
      metadata: {
        label: "View Proof",
        filename: selectedFile.name,
        mimeType: selectedFile.type || "image/*",
        size: selectedFile.size,
      },
    };
  }

  const rawValue = evidenceValue.trim();
  if (!rawValue) {
    return null;
  }

  if (mode === "tx") {
    const normalizedUrl = /^https?:\/\//i.test(rawValue)
      ? normalizeUrl(rawValue)
      : `https://solscan.io/tx/${encodeURIComponent(rawValue)}`;

    return {
      type: "tx",
      url: normalizedUrl!,
      metadata: {
        label: "TX Hash",
        txHash: rawValue,
      },
    };
  }

  const normalizedUrl = normalizeUrl(rawValue);

  return {
    type: mode,
    url: normalizedUrl!,
    metadata: {
      label: evidenceLabel(mode),
      source: rawValue,
    },
  };
}

function VerifyClaimDialog({ onClose, kolSlug, feeAmount, onCommentCreated }: VerifyClaimDialogProps) {
  const { session, requireWalletForWrite } = useWalletSession();
  const [selectedTag, setSelectedTag] = useState<(typeof classificationTags)[number]>("Good Calls");
  const [selectedEvidenceMode, setSelectedEvidenceMode] = useState<EvidenceMode>("image");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceValue, setEvidenceValue] = useState("");
  const [draftComment, setDraftComment] = useState<CommentView | null>(null);
  const [submission, setSubmission] = useState<SubmissionState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const evidenceModeMeta = getEvidenceModeMeta(selectedEvidenceMode);

  function resetEvidence() {
    setSelectedFile(null);
    setEvidenceValue("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    onClose();
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);

    if (submission.kind === "error") {
      setSubmission({ kind: "idle" });
    }
  }

  function handleEvidenceModeChange(mode: EvidenceMode) {
    if (mode === selectedEvidenceMode) {
      return;
    }

    setSelectedEvidenceMode(mode);
    resetEvidence();

    if (submission.kind === "error") {
      setSubmission({ kind: "idle" });
    }
  }

  async function attachEvidence(comment: CommentView, preparedEvidence: PreparedEvidence) {
    let response: Response;

    if (preparedEvidence.type === "image") {
      const formData = new FormData();
      formData.append("type", preparedEvidence.type);
      formData.append("file", preparedEvidence.file);
      formData.append("metadata", JSON.stringify(preparedEvidence.metadata));

      response = await fetch(`/api/comments/${comment.id}/evidence`, {
        method: "POST",
        body: formData,
      });
    } else {
      response = await fetch(`/api/comments/${comment.id}/evidence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: preparedEvidence.type,
          url: preparedEvidence.url,
          metadata: preparedEvidence.metadata,
        }),
      });
    }
    const result = await parseApiResponse<AttachEvidenceResponse>(response);
    return mergeCommentEvidence(comment, result, preparedEvidence.metadata);
  }

  async function handleSubmit() {
    const body = description.trim();
    if (!draftComment && body.length < 3) {
      setSubmission({ kind: "error", message: "Add verdict details before submitting." });
      return;
    }

    if (!session) {
      const granted = await requireWalletForWrite({
        title: "Connect wallet to continue",
        message: "Connect your wallet to submit a verdict and attach evidence.",
        cardClassName: "max-w-[18rem] rounded-[1.5rem] px-5 py-5",
      });

      if (!granted) {
        return;
      }
    }

    setSubmission({ kind: "loading" });

    try {
      const preparedEvidence = prepareEvidence(selectedEvidenceMode, selectedFile, evidenceValue);
      let createdComment = draftComment;

      if (!createdComment) {
        const payload: CreateCommentRequest = {
          body,
          tag: selectedTag,
          feeAmount,
        };

        const response = await fetch(`/api/kols/${kolSlug}/comments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await parseApiResponse<CreateCommentResponse>(response);
        createdComment = result.comment;
      }

      if (preparedEvidence) {
        try {
          const enrichedComment = await attachEvidence(createdComment, preparedEvidence);
          onCommentCreated?.(enrichedComment);
        } catch (error) {
          onCommentCreated?.(createdComment);
          setDraftComment(createdComment);
          setSubmission({
            kind: "error",
            message:
              `Verdict submitted. ${toUserFacingApiError(error, "Retry upload.", {
                unauthorizedMessage: "Reconnect wallet to continue.",
              })} Retry upload.`,
          });
          return;
        }
      } else {
        onCommentCreated?.(createdComment);
      }

      setDraftComment(null);
      setSubmission({
        kind: "success",
        message: preparedEvidence ? "Verdict and evidence recorded." : "Verdict submitted to the registry.",
      });
      setDescription("");
      resetEvidence();

      window.setTimeout(() => {
        handleClose();
      }, 450);
    } catch (error) {
      setSubmission({
        kind: "error",
        message: toUserFacingApiError(error, "Unable to submit verdict.", {
          unauthorizedMessage: "Reconnect wallet to continue.",
        }),
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[21.25rem] overflow-hidden rounded-[2rem] border border-white/8 bg-[rgba(38,38,38,0.84)] shadow-[0_24px_48px_rgba(0,0,0,0.6)] backdrop-blur-[20px] sm:max-w-[31.5rem]"
      >
        <div className="flex items-center justify-between px-7 pb-4 pt-7 sm:px-8 sm:pt-8">
          <h2 className="font-display text-[2rem] font-extrabold tracking-[-0.06em] text-white">SUBMIT VERDICT</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-on-surface-variant transition-colors hover:text-white"
            aria-label="Close verdict modal"
          >
            <Icon name="close" className="text-[1.35rem]" />
          </button>
        </div>

        <div className="space-y-6 px-7 pb-7 sm:px-8 sm:pb-8">
          <div className="space-y-2">
            <label className="px-1 font-display text-[0.66rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              Verdict Details
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={submission.kind === "loading" || Boolean(draftComment)}
              placeholder="Detail your verdict, timing, and what the attached proof confirms."
              className="h-28 w-full resize-none rounded-xl border border-transparent bg-surface-container-lowest p-4 text-base leading-7 text-on-surface placeholder:text-outline/50 transition-colors duration-300 focus:border-primary-dim focus:outline-none disabled:cursor-default disabled:opacity-75"
            />
          </div>

          <div className="space-y-3">
            <label className="px-1 font-display text-[0.66rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              Classification Tags
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {classificationTags.map((tag) => {
                const selected = selectedTag === tag;

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    disabled={submission.kind === "loading" || Boolean(draftComment)}
                    className={cx(
                      "rounded-lg border px-3 py-2.5 font-display text-[0.68rem] font-bold uppercase tracking-[0.04em] transition-all duration-300",
                      submission.kind === "loading" || Boolean(draftComment) ? "cursor-default opacity-70" : "",
                      tagTone(tag, selected),
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="px-1 font-display text-[0.66rem] font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              Evidence Type
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {evidenceModes.map((mode) => {
                const selected = selectedEvidenceMode === mode.value;

                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => handleEvidenceModeChange(mode.value)}
                    disabled={submission.kind === "loading"}
                    className={cx(
                      "flex items-center gap-2 rounded-xl border px-3 py-3 font-display text-[0.7rem] font-bold uppercase tracking-[0.08em] transition-all duration-300",
                      selected
                        ? "border-secondary/30 bg-secondary/10 text-secondary"
                        : "border-outline-variant/12 bg-surface-container-low text-on-surface-variant hover:border-white/10 hover:bg-surface-bright",
                      submission.kind === "loading" ? "cursor-default opacity-70" : "",
                    )}
                  >
                    <Icon name={mode.icon} className="text-[1rem]" />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAttachmentSelection}
            />

            {selectedEvidenceMode === "image" ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submission.kind === "loading"}
                className="group flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-high px-4 py-4 transition-all duration-300 hover:bg-surface-bright"
                title={selectedFile?.name}
              >
                <Icon
                  name="attachment"
                  className="text-[1.25rem] text-secondary transition-transform duration-300 group-hover:scale-110"
                />
                <span className="max-w-[14rem] truncate font-display text-[0.95rem] font-semibold tracking-[-0.02em] text-on-surface">
                  {selectedFile?.name ?? evidenceModeMeta.placeholder}
                </span>
              </button>
            ) : (
              <input
                type={selectedEvidenceMode === "tx" ? "text" : "url"}
                value={evidenceValue}
                onChange={(event) => setEvidenceValue(event.target.value)}
                disabled={submission.kind === "loading"}
                placeholder={evidenceModeMeta.placeholder}
                className="w-full rounded-xl border border-transparent bg-surface-container-lowest px-4 py-4 text-sm text-on-surface placeholder:text-outline/50 transition-colors duration-300 focus:border-secondary/40 focus:outline-none disabled:cursor-default disabled:opacity-75"
              />
            )}

            <p className="px-1 font-display text-[0.52rem] font-bold uppercase tracking-[0.18em] text-on-surface-variant/70">
              {evidenceModeMeta.helper}
            </p>
          </div>

          <div className="border-t border-outline-variant/10 pt-4">
            <div className="mb-6 flex items-center justify-between px-1">
              <span className="font-display text-[0.95rem] font-medium text-on-surface-variant">Proof Fee:</span>
              <span className="font-display text-[1.55rem] font-bold tracking-[-0.05em] text-secondary">{feeAmount} ETH</span>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submission.kind === "loading"}
              className={cx(
                "flex w-full items-center justify-center gap-2 rounded-[1rem] bg-secondary px-5 py-5 font-display text-[1.25rem] font-extrabold tracking-[-0.04em] text-on-secondary shadow-[0_0_20px_rgba(0,207,252,0.3)] transition-all duration-300 active:scale-[0.985]",
                submission.kind === "loading"
                  ? "cursor-wait opacity-85"
                  : "hover:shadow-[0_0_30px_rgba(0,207,252,0.5)]",
              )}
            >
              {submission.kind === "loading"
                ? draftComment
                  ? "UPLOADING..."
                  : "SUBMITTING..."
                : submission.kind === "success"
                  ? "SUBMITTED"
                  : draftComment
                    ? "RETRY UPLOAD"
                    : "SUBMIT VERDICT"}
              <Icon name="security" filled className="text-[1.2rem]" />
            </button>
          </div>

          <div aria-live="polite" className="min-h-4 text-center">
            {submission.kind === "success" ? (
              <p className="font-display text-[0.56rem] font-bold uppercase tracking-[0.2em] text-primary">
                {submission.message}
              </p>
            ) : null}
            {submission.kind === "error" ? (
              <p className="font-display text-[0.56rem] font-bold uppercase tracking-[0.2em] text-tertiary">
                {submission.message}
              </p>
            ) : null}
          </div>

          <p className="text-center font-display text-[0.56rem] font-bold uppercase tracking-[0.24em] text-outline opacity-60">
            All entries are permanent on-chain.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function VerifyClaimModal({ open, onClose, kolSlug, feeAmount, onCommentCreated }: VerifyClaimModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <VerifyClaimDialog
          key={`${kolSlug}-${feeAmount}`}
          onClose={onClose}
          kolSlug={kolSlug}
          feeAmount={feeAmount}
          onCommentCreated={onCommentCreated}
        />
      ) : null}
    </AnimatePresence>
  );
}
