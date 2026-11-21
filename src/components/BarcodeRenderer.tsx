import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface BarcodeRendererProps {
  value: string;
  type: 'code128' | 'qr' | 'none';
  width?: number;
  height?: number;
  size?: number;
  displayValue?: boolean;
  isThermal?: boolean;
}

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  type,
  width = 1.3,
  height = 36,
  size,
  displayValue = false,
  isThermal = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (type === 'code128' && svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: isThermal ? 1.1 : width,
          height: isThermal ? 32 : height,
          displayValue: displayValue,
          margin: 2,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (e) {
        console.warn('Error generating Code128 barcode:', e);
      }
    }
  }, [value, type, width, height, displayValue, isThermal]);

  useEffect(() => {
    if (type === 'qr' && canvasRef.current && value) {
      try {
        QRCode.toCanvas(canvasRef.current, value, {
          width: size || (isThermal ? 72 : 84),
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });
      } catch (e) {
        console.warn('Error generating QR code:', e);
      }
    }
  }, [value, type, isThermal, size]);

  if (type === 'none' || !value) {
    return null;
  }

  if (type === 'qr') {
    return (
      <div className="flex flex-col items-center justify-center my-0.5">
        <canvas ref={canvasRef} className="max-w-full block" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center my-0.5 overflow-hidden">
      <svg ref={svgRef} className="max-w-full block" />
    </div>
  );
};
