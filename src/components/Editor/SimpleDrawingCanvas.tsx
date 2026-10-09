
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Paintbrush, Eraser, Save, Trash2 } from "lucide-react";
import { i18n } from "@/lib/i18n";

interface SimpleDrawingCanvasProps {
  width?: number;
  height?: number;
  onSave?: (dataURL: string) => void;
  backgroundColor?: string;
  disabled?: boolean;
}

const SimpleDrawingCanvas = ({
  width = 800,
  height = 600,
  onSave,
  backgroundColor = "#ffffff",
  disabled = false
}: SimpleDrawingCanvasProps) => {
  const { t } = i18n;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  
  // Color options
  const colors = [
    "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", 
    "#ffff00", "#ff00ff", "#00ffff", "#ff9900", "#9900ff",
    "#99ff00", "#009900", "#990000", "#000099", "#999999"
  ];

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setContext(ctx);

    // Fill with background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [width, height, backgroundColor]);

  // Helper to get correct coordinates
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Handle both React.MouseEvent and native MouseEvent
      clientX = (e as React.MouseEvent).clientX || (e as MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY || (e as MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!context || disabled) return;
    
    setDrawing(true);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { x, y } = getCoordinates(e, canvas);
    
    context.beginPath();
    context.moveTo(x, y);
    
    if (tool === "brush") {
      context.strokeStyle = color;
    } else {
      context.strokeStyle = backgroundColor;
    }
    
    context.lineWidth = brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!context || !drawing || disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { x, y } = getCoordinates(e, canvas);
    
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!context || disabled) return;
    setDrawing(false);
    context.closePath();
  };

  const clearCanvas = () => {
    if (!context || disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvas = () => {
    if (!canvasRef.current || !onSave || disabled) return;
    
    const dataURL = canvasRef.current.toDataURL("image/png");
    onSave(dataURL);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center pb-2 border-b">
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={disabled}
            variant={tool === "brush" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("brush")}
            className={tool === "brush" ? "bg-story-purple" : ""}
          >
            <Paintbrush className="h-4 w-4 mr-1" />
            {t("story.drawing.brush")}
          </Button>
          <Button
            type="button"
            disabled={disabled}
            variant={tool === "eraser" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("eraser")}
            className={tool === "eraser" ? "bg-story-purple" : ""}
          >
            <Eraser className="h-4 w-4 mr-1" />
            {t("story.drawing.eraser")}
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="flex items-center" disabled={disabled}>
                <div
                  className="w-4 h-4 rounded-full mr-1"
                  style={{ backgroundColor: color }}
                ></div>
                {t("story.drawing.color")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="grid grid-cols-5 gap-2">
                {colors.map((c) => (
                  <button type="button"
                    key={c}
                    disabled={disabled}
                    className={`w-6 h-6 rounded-full ${
                      c === color ? "ring-2 ring-story-purple" : ""
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          <div className="flex items-center gap-2">
            <span className="text-xs">{t("story.drawing.size")}</span>
            <Slider
              value={[brushSize]}
              disabled={disabled}
              min={1}
              max={20}
              step={1}
              onValueChange={(value) => setBrushSize(value[0])}
              className="w-20"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={disabled}
            variant="outline"
            size="sm"
            onClick={clearCanvas}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t("story.drawing.clear")}
          </Button>
          {onSave && (
            <Button
              type="button"
              disabled={disabled}
              size="sm"
              onClick={saveCanvas}
              className="bg-story-purple"
            >
              <Save className="h-4 w-4 mr-1" />
              {t("story.drawing.save")}
            </Button>
          )}
        </div>
      </div>
      
      <div className="border rounded-md overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          aria-disabled={disabled}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="max-w-full h-auto"
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  );
};

export default SimpleDrawingCanvas;
