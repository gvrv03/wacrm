'use client';

import { ExternalLink, Phone, Copy, Image, Video, FileText, Workflow, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { TemplateFormState } from '@/app/(dashboard)/templates/new/page';

interface TemplatePreviewProps {
  form: TemplateFormState;
}

/**
 * WhatsApp-style template preview with phone frame.
 * Renders formatting, buttons, and carousel cards.
 */
export function TemplatePreview({ form }: TemplatePreviewProps) {
  const hasMessage = form.body_text.trim() || form.header_text.trim() || form.header_type !== 'none';
  const hasCarousel = form.carousel_cards.length > 0;
  const hasContent = hasMessage || hasCarousel;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">Template preview</h3>
      </div>

      {/* Phone frame */}
      <div className="p-5 bg-muted/20 flex justify-center">
        <div className="w-[272px] rounded-[20px] border-[6px] border-gray-800 bg-gray-800 shadow-xl overflow-hidden">
          {/* Phone status bar */}
          <div className="h-5 bg-gray-800 flex items-center justify-center">
            <div className="w-16 h-1 rounded-full bg-gray-600" />
          </div>

          {/* WhatsApp header */}
          <div className="h-10 bg-[#075e54] flex items-center px-3 gap-2">
            <div className="size-7 rounded-full bg-white/20" />
            <div className="flex-1">
              <div className="h-2.5 w-20 rounded bg-white/40" />
              <div className="h-1.5 w-12 rounded bg-white/20 mt-1" />
            </div>
          </div>

          {/* Chat area */}
          <div className="bg-[#e5ddd5] min-h-[320px] p-3 flex flex-col justify-end" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5 L35 15 L30 25 L25 15Z\' fill=\'%23d4ccb5\' opacity=\'0.15\'/%3E%3C/svg%3E")' }}>
            {hasContent ? (
              <div className="space-y-1.5">
                {/* Message bubble */}
                {hasMessage && (
                  <div className="rounded-lg bg-white shadow-sm overflow-hidden max-w-[230px]">
                    {/* Header media */}
                    {form.header_type === 'image' && (
                      <div className="h-[100px] bg-gray-100 flex items-center justify-center overflow-hidden">
                        {form.header_media_url ? (
                          <img src={form.header_media_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Image className="size-6 text-gray-300" />
                        )}
                      </div>
                    )}
                    {form.header_type === 'video' && (
                      <div className="h-[100px] bg-gray-100 flex items-center justify-center">
                        {form.header_media_url ? (
                          <video src={form.header_media_url} className="w-full h-full object-cover" />
                        ) : (
                          <Video className="size-6 text-gray-300" />
                        )}
                      </div>
                    )}
                    {form.header_type === 'document' && (
                      <div className="h-10 bg-gray-50 flex items-center gap-2 px-2.5 border-b border-gray-100">
                        <FileText className="size-4 text-gray-400" />
                        <span className="text-[10px] text-gray-500">Document</span>
                      </div>
                    )}

                    {/* Header text */}
                    {form.header_type === 'text' && form.header_text && (
                      <div className="px-2.5 pt-2">
                        <p className="text-[12px] font-bold text-gray-900 leading-tight">
                          {form.header_text}
                        </p>
                      </div>
                    )}

                    {/* Body */}
                    {form.body_text && (
                      <div className="px-2.5 py-1.5">
                        <div
                          className="text-[11.5px] text-gray-800 leading-[1.45] [&_strong]:font-bold [&_em]:italic [&_del]:line-through [&_code]:font-mono [&_code]:text-[10.5px] [&_code]:bg-gray-100 [&_code]:px-0.5 [&_code]:rounded-sm"
                          dangerouslySetInnerHTML={{ __html: renderWhatsAppFormatting(form.body_text) }}
                        />
                      </div>
                    )}

                    {/* Footer */}
                    {form.footer_text && (
                      <div className="px-2.5 pb-0.5">
                        <p className="text-[10px] text-gray-400 leading-tight">
                          {form.footer_text}
                        </p>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="px-2.5 pb-1 flex justify-end">
                      <span className="text-[9px] text-gray-400">10:32</span>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                {form.buttons.length > 0 && (
                  <div className="space-y-[1px] max-w-[230px]">
                    {form.buttons.length <= 3 ? (
                      form.buttons.map((btn) => (
                        <PreviewButton key={btn.id} btn={btn} />
                      ))
                    ) : (
                      <>
                        {form.buttons.slice(0, 2).map((btn) => (
                          <PreviewButton key={btn.id} btn={btn} />
                        ))}
                        <div className="flex w-full items-center justify-center gap-1 rounded-md bg-white py-1.5 text-[10.5px] font-medium text-[#00a884] shadow-sm">
                          See all options
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Carousel */}
                {hasCarousel && <CarouselPreview cards={form.carousel_cards} />}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-[10px] text-gray-500">
                  Your template preview will appear here
                </p>
              </div>
            )}
          </div>

          {/* Phone bottom bar */}
          <div className="h-4 bg-gray-800 flex items-center justify-center">
            <div className="w-20 h-1 rounded-full bg-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Carousel
// ============================================================

interface CarouselCard {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  body_text: string;
  buttons: { id: string; text: string }[];
}

function CarouselPreview({ cards }: { cards: CarouselCard[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const goNext = () => setActiveIndex((i) => Math.min(i + 1, cards.length - 1));
  const goPrev = () => setActiveIndex((i) => Math.max(i - 1, 0));

  return (
    <div className="space-y-1.5 max-w-[230px]">
      <div className="relative overflow-hidden rounded-lg">
        <div
          className="flex transition-transform duration-200 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {cards.map((card, idx) => (
            <div key={card.id} className="min-w-full px-0.5">
              <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                {/* Media */}
                <div className="h-[80px] bg-gray-100 flex items-center justify-center overflow-hidden">
                  {card.media_url ? (
                    <img src={card.media_url} alt={`Card ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : card.media_type === 'video' ? (
                    <Video className="size-5 text-gray-300" />
                  ) : (
                    <Image className="size-5 text-gray-300" />
                  )}
                </div>

                {/* Body */}
                {card.body_text && (
                  <div className="px-2 py-1.5">
                    <div
                      className="text-[10.5px] text-gray-800 leading-[1.4] line-clamp-3 [&_strong]:font-bold [&_em]:italic [&_del]:line-through"
                      dangerouslySetInnerHTML={{ __html: renderWhatsAppFormatting(card.body_text) }}
                    />
                  </div>
                )}

                {/* Buttons */}
                {card.buttons.length > 0 && (
                  <div className="border-t border-gray-100">
                    {card.buttons.map((cbtn) => (
                      <div key={cbtn.id} className="flex items-center justify-center py-1.5 text-[10px] font-medium text-[#00a884] border-b border-gray-50 last:border-b-0">
                        {cbtn.text || 'Button'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Arrows */}
        {cards.length > 1 && activeIndex > 0 && (
          <button type="button" onClick={goPrev} className="absolute left-1 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-full bg-white/90 shadow text-gray-600">
            <ChevronLeft className="size-3" />
          </button>
        )}
        {cards.length > 1 && activeIndex < cards.length - 1 && (
          <button type="button" onClick={goNext} className="absolute right-1 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-full bg-white/90 shadow text-gray-600">
            <ChevronRight className="size-3" />
          </button>
        )}
      </div>

      {/* Dots */}
      {cards.length > 1 && (
        <div className="flex items-center justify-center gap-1">
          {cards.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`size-1.5 rounded-full transition-colors ${idx === activeIndex ? 'bg-[#00a884]' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared
// ============================================================

function PreviewButton({ btn }: { btn: { type: string; text: string } }) {
  return (
    <div className="flex w-full items-center justify-center gap-1 rounded-md bg-white py-1.5 text-[10.5px] font-medium text-[#00a884] shadow-sm">
      <ButtonIcon type={btn.type} />
      <span>{btn.text || 'Button'}</span>
    </div>
  );
}

function ButtonIcon({ type }: { type: string }) {
  const cls = "size-3";
  switch (type) {
    case 'url': return <ExternalLink className={cls} />;
    case 'phone_number': return <Phone className={cls} />;
    case 'copy_code': return <Copy className={cls} />;
    case 'flow': return <Workflow className={cls} />;
    default: return null;
  }
}

// ============================================================
// Formatting
// ============================================================

function renderWhatsAppFormatting(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, '<code>$1</code>');
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  html = html.replace(/~(.*?)~/g, '<del>$1</del>');
  html = html.replace(
    /\{\{(\d+)\}\}/g,
    '<span style="background:#dcfce7;color:#166534;padding:0 3px;border-radius:2px;font-size:10px;">{{$1}}</span>'
  );
  html = html.replace(/\n/g, '<br>');
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
