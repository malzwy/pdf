import React, { useState, useCallback } from 'react';
import { Upload, Languages, FileText } from 'lucide-react';
import { PdfViewer } from './components/PdfViewer';

const LANGUAGES = [
  { code: 'Chinese (Simplified)', name: 'Chinese (Simplified)' },
  { code: 'English', name: 'English' },
  { code: 'Japanese', name: 'Japanese' },
  { code: 'Korean', name: 'Korean' },
  { code: 'Spanish', name: 'Spanish' },
  { code: 'French', name: 'French' },
  { code: 'German', name: 'German' },
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState(LANGUAGES[0].code);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      alert('Please select a valid PDF file.');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col font-sans">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Languages size={24} />
            </div>
            <h1 className="font-semibold text-xl tracking-tight text-neutral-900">Layout-Preserving PDF Translator</h1>
          </div>
          
          {file && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-600">Target Language:</span>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="block w-48 rounded-md border-neutral-300 py-1.5 pl-3 pr-10 text-neutral-900 bg-neutral-50 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm border transition-shadow outline-none"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-sm font-medium text-neutral-500 hover:text-neutral-700 px-3 py-1.5"
              >
                Close PDF
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col">
        {!file ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div 
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="w-full max-w-2xl border-2 border-dashed border-neutral-300 rounded-2xl p-12 flex flex-col items-center justify-center bg-white hover:bg-neutral-50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-600">
                <Upload size={32} />
              </div>
              <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Upload a PDF to translate</h2>
              <p className="text-neutral-500 mb-8 text-center max-w-sm">
                Drag and drop your PDF here, or click to browse. We will extract text layout and replace it with translations.
              </p>
              
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={onFileChange}
              />
              
              <span className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors">
                Select PDF File
              </span>
            </div>
            
            <div className="mt-12 flex items-start gap-4 p-4 bg-orange-50 rounded-xl max-w-2xl text-orange-800">
              <FileText className="shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold mb-1">Dual Translation Architectures</h3>
                <p className="text-sm opacity-90 leading-relaxed mb-2">
                  <strong className="text-blue-700">1. OCR Split Reflow:</strong> Passes visual captures to Gemini 2.5 Flash Vision to extract text and natural structure, rendering side-by-side in Markdown. Completely eliminates boundary overlapping glitches.
                </p>
                <p className="text-sm opacity-90 leading-relaxed">
                   <strong className="text-green-700">2. Server HTML Mode (pdf2htmlEX PoC):</strong> Utilizes a Node.js Express backend and Cheerio to parse HTML DOM structures mathematically. Ready for local deployment with `pdf2htmlEX` to retain 100% of underlying background visuals!
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full bg-white rounded-2xl shadow-sm border overflow-hidden">
            <PdfViewer file={file} targetLanguage={targetLanguage} />
          </div>
        )}
      </main>
    </div>
  );
}

