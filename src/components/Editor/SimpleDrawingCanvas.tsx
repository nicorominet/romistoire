
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Paintbrush, Eraser, Save, Trash2 } from "lucide-react";

interface SimpleDrawingCanvasProps {
  width?: number;
  height?: number;
  onSave?: (dataURL: string) => void;
  backgroundColor?: string;
}

const SimpleDrawingCanvas = ({
  width = 800,
  height = 600,
  onSave,
  backgroundColor = "#ffffff"
}: SimpleDrawingCanvasProps) => {
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
    if (!context) return;
    
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
    if (!context || !drawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const { x, y } = getCoordinates(e, canvas);
    
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!context) return;
    setDrawing(false);
    context.closePath();
  };

  const clearCanvas = () => {
    if (!context) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvas = () => {
    if (!canvasRef.current || !onSave) return;
    
    const dataURL = canvasRef.current.toDataURL("image/png");
    onSave(dataURL);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center pb-2 border-b">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={tool === "brush" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("brush")}
            className={tool === "brush" ? "bg-story-purple" : ""}
          >
            <Paintbrush className="h-4 w-4 mr-1" />
            Brush
          </Button>
          <Button
            type="button"
            variant={tool === "eraser" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("eraser")}
            className={tool === "eraser" ? "bg-story-purple" : ""}
          >
            <Eraser className="h-4 w-4 mr-1" />
            Eraser
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center">
                <div
                  className="w-4 h-4 rounded-full mr-1"
                  style={{ backgroundColor: color }}
                ></div>
                Color
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="grid grid-cols-5 gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
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
            <span className="text-xs">Size:</span>
            <Slider
              value={[brushSize]}
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
            variant="outline"
            size="sm"
            onClick={clearCanvas}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          {onSave && (
            <Button
              type="button"
              size="sm"
              onClick={saveCanvas}
              className="bg-story-purple"
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          )}
        </div>
      </div>
      
      <div className="border rounded-md overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
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
