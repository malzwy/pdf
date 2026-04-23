import React, { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, ChevronLeft, ChevronRight, Languages } from 'lucide-react';
import { translatePageImage } from '../services/translator';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPageProps {
  file: File;
  targetLanguage: string;
}

export function PdfViewer({ file, targetLanguage }: PdfPageProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [isTranslating, setIsTranslating] = useState(false);
  const [viewMode, setViewMode] = useState<'original' | 'split'>('original');
  
  // Track OCR Markdown translations per page
  const [markdownTranslations, setMarkdownTranslations] = useState<Record<number, string>>({});

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setMarkdownTranslations({});
    setViewMode('original');
  };

  const capturePageImage = async (pageNum: number): Promise<string | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      const page = await pdf.getPage(pageNum);
      
      // Render at a high resolution for OCR
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const canvasContext = canvas.getContext('2d');
      if (!canvasContext) return null;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext,
        viewport,
      }).promise;

      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      console.error("Failed to capture page image", error);
      return null;
    }
  };

  const handleTranslatePage = async () => {
    if (!targetLanguage || isTranslating) return;
    
    // If we already have translations for this page, just switch to split view
    if (markdownTranslations[pageNumber]) {
      setViewMode('split');
      return;
    }

    setIsTranslating(true);
    try {
      const base64Image = await capturePageImage(pageNumber);
      if (base64Image) {
        const translatedMarkdown = await translatePageImage(base64Image, targetLanguage);
        setMarkdownTranslations(prev => ({ ...prev, [pageNumber]: translatedMarkdown }));
        setViewMode('split');
      }
    } finally {
      setIsTranslating(false);
    }
  };

  // When language changes, clear translations
  useEffect(() => {
    setMarkdownTranslations({});
    setViewMode('original');
  }, [targetLanguage]);

  const hasTranslation = !!markdownTranslations[pageNumber];

  return (
    <div className="flex flex-col items-center w-full max-w-full mx-auto h-full">
      <div className="flex items-center justify-between w-full bg-white p-4 border-b rounded-t-lg shadow-sm z-10 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium whitespace-nowrap">
            Page {pageNumber || (numPages ? 1 : '--')} of {numPages || '--'}
          </span>
          <button
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        
        {hasTranslation && (
          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
             <button
              onClick={() => setViewMode('original')}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'original' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}
            >
              Original PDF
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'split' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700')}
            >
              OCR Reflow & Translate
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="px-3 py-1 rounded hover:bg-white transition-colors text-sm font-medium"
            >-</button>
            <span className="text-sm font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(3, s + 0.25))}
              className="px-3 py-1 rounded hover:bg-white transition-colors text-sm font-medium"
            >+</button>
          </div>

          <button
            onClick={handleTranslatePage}
            disabled={isTranslating || (hasTranslation && viewMode === 'split')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium shadow-sm whitespace-nowrap"
          >
            {isTranslating ? <Loader2 size={18} className="animate-spin" /> : <Languages size={18} />}
            {hasTranslation ? 'Re-translate' : 'Translate Page'}
          </button>
        </div>
      </div>

      <div className="flex-1 w-full overflow-auto bg-gray-200 flex justify-center pb-20 relative border border-t-0 rounded-b-lg">
        {viewMode === 'original' ? (
          <div className="p-6">
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              className="flex flex-col items-center shadow-lg"
              loading={
                <div className="flex items-center gap-2 text-gray-500 mt-10">
                  <Loader2 className="animate-spin" /> Loading PDF...
                </div>
              }
            >
              <Page
                key={`page_${pageNumber}_original`}
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        ) : (
          <div className="flex w-full min-w-max p-6 gap-8 justify-center items-start">
            {/* Original PDF on the left */}
            <div className="flex flex-col drop-shadow-xl bg-white">
              <Document
                file={file}
                className="flex flex-col items-center"
              >
                <Page
                  key={`page_${pageNumber}_split_original`}
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>
            
            {/* Markdown Reflow View on the right */}
            <div 
              className="flex-none bg-white drop-shadow-xl p-10 overflow-auto"
              style={{
                /* Match the width and height somewhat closely to the PDF rendering */
                width: `${750 * scale}px`,
                minHeight: `${1000 * scale}px`
              }}
            >
              <div className="markdown-body prose prose-slate max-w-none text-left">
                <ReactMarkdown>
                  {markdownTranslations[pageNumber] || "Translation loading..."}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
