import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, ChevronLeft, ChevronRight, Languages } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { translatePageImage } from '../services/translator';

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
  const [viewMode, setViewMode] = useState<'original' | 'split' | 'server-html'>('original');
  
  // Track OCR Markdown translations per page
  const [markdownTranslations, setMarkdownTranslations] = useState<Record<number, string>>({});

  // Rendered Backend Cheerio HTML Blob URL
  const [translatedHtmlUrl, setTranslatedHtmlUrl] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setMarkdownTranslations({});
    setTranslatedHtmlUrl(null);
    setViewMode('original');
  };

  const capturePageImage = async (pageNum: number): Promise<string | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      const page = await pdf.getPage(pageNum);
      
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

  const handleTranslatePageOCR = async () => {
    if (!targetLanguage || isTranslating) return;
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

  // Node.js Backend 4-Step architecture payload run
  const handleTranslatePageBackend = async () => {
    if (!targetLanguage || isTranslating) return;
    
    setIsTranslating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Step 1: Backend parses PDF to HTML and extracts text fragments
      const responseStep1 = await fetch('/api/translate-pdf-step1', {
        method: 'POST',
        body: formData,
      });

      if (!responseStep1.ok) {
        const errText = await responseStep1.text();
        console.error("Step 1 failed with text:", errText);
        throw new Error('Failed to extract HTML and text from PDF');
      }
      
      const rawRes = await responseStep1.text();
      let step1Data;
      try {
        step1Data = JSON.parse(rawRes);
      } catch (e) {
        console.error("Step 1 returned invalid JSON. Raw response start:", rawRes.slice(0, 200));
        throw new Error("Invalid response from server");
      }

      const { jobId, fragments } = step1Data;

      // Step 2: Client translates fragments using Gemini API (via AI Studio Proxy)
      const translatedFragments = await translateTextFragments(fragments, targetLanguage);

      // Step 3: Backend injects translated fragments into HTML using job context
      const responseStep2 = await fetch('/api/translate-pdf-step2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, translatedFragments }),
      });

      if (!responseStep2.ok) {
        throw new Error('Failed to inject translations into HTML');
      }

      const finalHtmlText = await responseStep2.text();
      const blob = new Blob([finalHtmlText], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);

      setTranslatedHtmlUrl(blobUrl);
      setViewMode('server-html');

    } catch (error) {
      console.error("Backend rendering error:", error);
      alert("Backend processing failed. Please check server logs.");
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    setMarkdownTranslations({});
    setTranslatedHtmlUrl(null);
    setViewMode('original');
  }, [targetLanguage, file]);

  const hasTranslation = !!markdownTranslations[pageNumber] || translatedHtmlUrl;

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
        
        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
           <button
            onClick={() => setViewMode('original')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'original' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700')}
          >
            Original PDF
          </button>
          
          <button
            onClick={markdownTranslations[pageNumber] ? () => setViewMode('split') : handleTranslatePageOCR}
            disabled={isTranslating}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'split' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 disabled:opacity-50')}
          >
            {isTranslating && viewMode !== 'server-html' ? <Loader2 size={16} className="animate-spin inline mr-1" /> : null}
            OCR Split Reflow
          </button>

          <button
            onClick={translatedHtmlUrl ? () => setViewMode('server-html') : handleTranslatePageBackend}
            disabled={isTranslating}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", viewMode === 'server-html' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700 disabled:opacity-50')}
          >
             {isTranslating && viewMode === 'server-html' ? <Loader2 size={16} className="animate-spin inline mr-1" /> : null}
             Server HTML Mode
          </button>
        </div>

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
        ) : viewMode === 'server-html' && translatedHtmlUrl ? (
           <div className="w-full h-full bg-white"> 
              <iframe src={translatedHtmlUrl} className="w-full h-full min-h-[85vh] border-0" title="Backend Rendered HTML" />
           </div>
        ) : viewMode === 'split' ? (
          <div className="flex w-full min-w-max p-6 gap-8 justify-center items-start">
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
            
            <div 
              className="flex-none bg-white drop-shadow-xl p-10 overflow-auto"
              style={{
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
        ) : (
           <div className="flex items-center justify-center h-full text-gray-500">
             <Loader2 className="animate-spin w-8 h-8 mr-2" /> Processing translation...
           </div>
        )}
      </div>
    </div>
  );
}
