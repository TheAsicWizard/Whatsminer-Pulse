import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  RotateCw,
  Trash2,
  MapPin,
  Check,
  X,
  Image,
  Loader2,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SkipForward,
} from "lucide-react";
import type { Container, SiteSettings } from "@shared/schema";

export default function SiteLayoutEditor() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [layouts, setLayouts] = useState<Map<string, { x: number; y: number; rotation: number }>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [placementHistory, setPlacementHistory] = useState<string[]>([]);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);

  const [editorZoom, setEditorZoom] = useState(1);
  const [editorPan, setEditorPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const { data: containersRaw } = useQuery<Container[]>({
    queryKey: ["/api/containers/list"],
  });

  const { data: siteSettings } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
  });

  const containers = containersRaw || [];
  const sortedContainers = [...containers].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const unplacedContainers = sortedContainers.filter((c) => !layouts.has(c.id));
  const availableContainers = unplacedContainers.filter((c) => !skippedIds.has(c.id));
  const nextContainer = availableContainers[0] || null;
  const placedCount = layouts.size;
  const totalCount = containers.length;

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (containers.length > 0 && !initialized) {
      const initial = new Map<string, { x: number; y: number; rotation: number }>();
      containers.forEach((c) => {
        if (c.layoutX != null && c.layoutY != null) {
          initial.set(c.id, { x: c.layoutX, y: c.layoutY, rotation: c.layoutRotation ?? 0 });
        }
      });
      setLayouts(initial);
      setInitialized(true);
    }
  }, [containers, initialized]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/site-settings/background", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({ title: "Background uploaded", description: "Your site image has been set as the background." });
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });

  const pendingSavesRef = useRef(0);

  const invalidateLayoutQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/containers/list"] });
    queryClient.invalidateQueries({ queryKey: ["/api/containers/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
  }, []);

  const saveContainerLayout = useCallback(async (containerId: string, layoutX: number | null, layoutY: number | null, layoutRotation: number | null) => {
    pendingSavesRef.current++;
    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/containers/layouts", {
        layouts: [{ id: containerId, layoutX, layoutY, layoutRotation }],
      });
      invalidateLayoutQueries();
    } catch {
      toast({ title: "Auto-save failed", variant: "destructive" });
    } finally {
      pendingSavesRef.current--;
      if (pendingSavesRef.current === 0) {
        setIsSaving(false);
      }
    }
  }, [toast, invalidateLayoutQueries]);

  const removeBackgroundMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/site-settings", { backgroundImage: null, useCustomLayout: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({ title: "Background removed" });
    },
  });

  const clearAllLayoutsMutation = useMutation({
    mutationFn: async () => {
      const allLayouts = containers.map((c) => ({
        id: c.id,
        layoutX: null,
        layoutY: null,
        layoutRotation: null,
      }));
      await apiRequest("POST", "/api/containers/layouts", { layouts: allLayouts });
      await apiRequest("PATCH", "/api/site-settings", { useCustomLayout: false });
    },
    onSuccess: () => {
      setLayouts(new Map());
      setPlacementHistory([]);
      setSkippedIds(new Set());
      setSelectedContainerId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({ title: "Layout cleared", description: "All container positions have been reset." });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const oldZoom = editorZoom;
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      const newZoom = Math.min(8, Math.max(0.3, oldZoom + delta));
      const scale = newZoom / oldZoom;
      setEditorPan((prev) => ({
        x: mouseX - (mouseX - prev.x) * scale,
        y: mouseY - (mouseY - prev.y) * scale,
      }));
      setEditorZoom(newZoom);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editorZoom]);

  const handleEditorMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - editorPan.x, y: e.clientY - editorPan.y });
    }
  }, [editorPan]);

  const handleEditorMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setEditorPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleEditorMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetEditorView = useCallback(() => {
    setEditorZoom(1);
    setEditorPan({ x: 0, y: 0 });
  }, []);

  const screenToImagePercent = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!imgContainerRef.current) return null;
    const rect = imgContainerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning || e.altKey) return;
      const pos = screenToImagePercent(e.clientX, e.clientY);
      if (!pos) return;

      if (nextContainer) {
        const rotation = currentRotation;
        setLayouts((prev) => {
          const next = new Map(prev);
          next.set(nextContainer.id, { x: pos.x, y: pos.y, rotation });
          return next;
        });
        setPlacementHistory((prev) => [...prev, nextContainer.id]);
        setSelectedContainerId(nextContainer.id);
        setCurrentRotation(rotation);
        saveContainerLayout(nextContainer.id, pos.x, pos.y, rotation);
      }
    },
    [nextContainer, currentRotation, isPanning, screenToImagePercent, saveContainerLayout]
  );

  const handleUndo = () => {
    if (placementHistory.length === 0) return;
    const lastId = placementHistory[placementHistory.length - 1];
    const lastPos = layouts.get(lastId);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setLayouts((prev) => {
      const next = new Map(prev);
      next.delete(lastId);
      return next;
    });
    if (lastPos) {
      setCurrentRotation(lastPos.rotation);
    }
    setPlacementHistory((prev) => prev.slice(0, -1));
    setSelectedContainerId(null);
    saveContainerLayout(lastId, null, null, null);
  };

  const handleSkip = () => {
    if (!nextContainer) return;
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.add(nextContainer.id);
      return next;
    });
  };

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRotationChange = (containerId: string, rotation: number) => {
    const existing = layouts.get(containerId);
    if (existing) {
      setLayouts((prev) => {
        const next = new Map(prev);
        next.set(containerId, { ...existing, rotation });
        return next;
      });
    }
    setCurrentRotation(rotation);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const pos = layouts.get(containerId);
      if (pos) {
        saveContainerLayout(containerId, pos.x, pos.y, rotation);
      }
    }, 500);
  };

  const handleRemoveFromLayout = (containerId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setLayouts((prev) => {
      const next = new Map(prev);
      next.delete(containerId);
      return next;
    });
    setPlacementHistory((prev) => prev.filter((id) => id !== containerId));
    if (selectedContainerId === containerId) setSelectedContainerId(null);
    saveContainerLayout(containerId, null, null, null);
  };

  const backgroundImage = siteSettings?.backgroundImage;
  const selectedLayout = selectedContainerId ? layouts.get(selectedContainerId) : null;
  const selectedContainer = selectedContainerId ? containers.find((c) => c.id === selectedContainerId) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Site Layout Editor
        </CardTitle>
        <CardDescription>
          Upload your site photo, then click on the map to place each container. Adjust rotation as needed — the next container will use the same angle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            data-testid="button-upload-background"
          >
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {backgroundImage ? "Change Background" : "Upload Site Image"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-background-file"
          />
          {backgroundImage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeBackgroundMutation.mutate()}
              data-testid="button-remove-background"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Background
            </Button>
          )}
          {isSaving && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </Badge>
          )}
          {placedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => clearAllLayoutsMutation.mutate()}
              disabled={clearAllLayoutsMutation.isPending}
              data-testid="button-clear-layout"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="text-placed-count">
                  {placedCount}/{totalCount} placed
                </Badge>
                {nextContainer && backgroundImage && (
                  <Badge variant="default" className="animate-pulse font-mono" data-testid="text-next-container">
                    Next: {nextContainer.name}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {nextContainer && backgroundImage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="h-7 px-2"
                    data-testid="button-skip"
                  >
                    <SkipForward className="h-3.5 w-3.5 mr-1" />
                    Skip
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={placementHistory.length === 0}
                  className="h-7 px-2"
                  data-testid="button-undo"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  Undo
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1 mb-1">
              <button
                onClick={() => setEditorZoom((z) => Math.min(8, z + 0.3))}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                data-testid="button-editor-zoom-in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditorZoom((z) => Math.max(0.3, z - 0.3))}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                data-testid="button-editor-zoom-out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={resetEditorView}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                data-testid="button-editor-reset-view"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-muted-foreground font-mono ml-1">{Math.round(editorZoom * 100)}%</span>
              <span className="text-[10px] text-muted-foreground ml-2">Scroll to zoom · Alt+drag to pan</span>
            </div>

            <div
              ref={canvasRef}
              className="relative border border-border rounded-lg overflow-hidden"
              style={{
                height: "600px",
                cursor: isPanning ? "grabbing" : nextContainer && backgroundImage ? "crosshair" : "grab",
                background: "linear-gradient(135deg, hsl(220, 15%, 8%) 0%, hsl(220, 12%, 11%) 50%, hsl(220, 15%, 8%) 100%)",
              }}
              onClick={handleCanvasClick}
              onMouseDown={handleEditorMouseDown}
              onMouseMove={handleEditorMouseMove}
              onMouseUp={handleEditorMouseUp}
              onMouseLeave={handleEditorMouseUp}
              data-testid="layout-editor-canvas"
            >
              {!backgroundImage && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Image className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Upload a site image to get started</p>
                    <p className="text-xs mt-1">Satellite photo, drone shot, or site plan</p>
                  </div>
                </div>
              )}

              <div
                ref={imgContainerRef}
                className="absolute"
                style={{
                  width: "100%",
                  height: "100%",
                  transform: `translate(${editorPan.x}px, ${editorPan.y}px) scale(${editorZoom})`,
                  transformOrigin: "0 0",
                }}
              >
                {backgroundImage && (
                  <img
                    src={backgroundImage}
                    alt="Site plan"
                    className="w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                )}
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
                {Array.from(layouts.entries()).map(([id, pos]) => {
                  const container = containers.find((c) => c.id === id);
                  if (!container) return null;
                  if (pos.x < 0 || pos.y < 0) return null;
                  const isSelected = selectedContainerId === id;
                  const canvasEl = canvasRef.current;
                  if (!canvasEl) return null;
                  const canvasW = canvasEl.clientWidth;
                  const canvasH = canvasEl.clientHeight;
                  const pixelX = editorPan.x + (pos.x / 100) * canvasW * editorZoom;
                  const pixelY = editorPan.y + (pos.y / 100) * canvasH * editorZoom;
                  return (
                    <div
                      key={id}
                      className="absolute pointer-events-auto"
                      style={{
                        left: `${pixelX}px`,
                        top: `${pixelY}px`,
                        transform: `translate(-50%, -50%) rotate(${pos.rotation}deg)`,
                        zIndex: isSelected ? 20 : 10,
                      }}
                    >
                      <div
                        className={`
                          px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer whitespace-nowrap
                          transition-all
                          ${isSelected
                            ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background"
                            : "bg-amber-600/90 text-white hover:bg-amber-500/90"
                          }
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContainerId(id);
                          const containerLayout = layouts.get(id);
                          if (containerLayout) {
                            setCurrentRotation(containerLayout.rotation);
                          }
                        }}
                        data-testid={`layout-container-${id}`}
                      >
                        {container.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-56 flex-shrink-0 space-y-3">
            <Card>
              <CardContent className="p-3 space-y-3">
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <RotateCw className="h-3 w-3" />
                    Rotation: {currentRotation}°
                  </Label>
                  <Slider
                    value={[currentRotation]}
                    onValueChange={([v]) => {
                      setCurrentRotation(v);
                      if (selectedContainerId && layouts.has(selectedContainerId)) {
                        handleRotationChange(selectedContainerId, v);
                      }
                    }}
                    min={0}
                    max={359}
                    step={1}
                    className="mt-2"
                    data-testid="slider-rotation"
                  />
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {[0, 45, 90, 135, 180, 270, 305, 325].map((deg) => (
                      <button
                        key={deg}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                          currentRotation === deg
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted-foreground/20 text-muted-foreground"
                        }`}
                        onClick={() => {
                          setCurrentRotation(deg);
                          if (selectedContainerId && layouts.has(selectedContainerId)) {
                            handleRotationChange(selectedContainerId, deg);
                          }
                        }}
                        data-testid={`button-rotation-${deg}`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Set the angle before clicking, or adjust after placing. The next container will use this same angle.
                </p>
              </CardContent>
            </Card>

            {selectedContainer && selectedLayout && (
              <Card className="border-primary/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold font-mono">{selectedContainer.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={() => handleRemoveFromLayout(selectedContainer.id)}
                      data-testid={`button-remove-${selectedContainer.id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Position: ({selectedLayout.x.toFixed(1)}%, {selectedLayout.y.toFixed(1)}%) · {selectedLayout.rotation}°
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground font-semibold">
                Queue ({availableContainers.length})
              </Label>
              <div className="max-h-[250px] overflow-y-auto space-y-0.5">
                {availableContainers.slice(0, 50).map((c, i) => (
                  <div
                    key={c.id}
                    className={`
                      px-2 py-1 rounded text-xs font-mono
                      ${i === 0
                        ? "bg-primary/20 text-primary border border-primary/30 font-bold"
                        : "bg-muted/30 text-muted-foreground"
                      }
                    `}
                    data-testid={`unplaced-${c.id}`}
                  >
                    {i === 0 && <MapPin className="h-3 w-3 inline mr-1" />}
                    {c.name}
                  </div>
                ))}
                {availableContainers.length > 50 && (
                  <p className="text-[10px] text-muted-foreground px-2">
                    ... and {availableContainers.length - 50} more
                  </p>
                )}
                {availableContainers.length === 0 && unplacedContainers.length === 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 py-1">
                    <Check className="h-3 w-3 text-green-500" />
                    All containers placed!
                  </p>
                )}
                {availableContainers.length === 0 && unplacedContainers.length > 0 && (
                  <p className="text-xs text-muted-foreground py-1">
                    All remaining containers are skipped. Restore some from the list below to continue.
                  </p>
                )}
              </div>
            </div>

            {skippedIds.size > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Skipped ({skippedIds.size})
                </Label>
                <div className="max-h-[100px] overflow-y-auto space-y-0.5">
                  {sortedContainers.filter((c) => skippedIds.has(c.id)).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-2 py-1 rounded text-xs font-mono bg-muted/30 text-muted-foreground"
                      data-testid={`skipped-${c.id}`}
                    >
                      <span>{c.name}</span>
                      <button
                        className="text-[9px] px-1 py-0.5 rounded bg-muted hover:bg-primary/20 hover:text-primary transition-colors"
                        onClick={() => {
                          setSkippedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(c.id);
                            return next;
                          });
                        }}
                        data-testid={`button-unskip-${c.id}`}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
