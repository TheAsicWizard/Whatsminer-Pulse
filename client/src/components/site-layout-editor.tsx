import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  RotateCw,
  Save,
  Trash2,
  MapPin,
  Check,
  X,
  Image,
  Loader2,
  Undo2,
  Wand2,
  SkipForward,
  Mouse,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Container, SiteSettings } from "@shared/schema";
import { getWolfHollowTemplate, getWolfHollowContainerNames, wolfHollowMapUrl } from "@/lib/wolf-hollow-template";

type ContainerLayout = {
  id: string;
  name: string;
  layoutX: number | null;
  layoutY: number | null;
  layoutRotation: number | null;
};

export default function SiteLayoutEditor() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<Map<string, { x: number; y: number; rotation: number }>>(new Map());
  const [isDirty, setIsDirty] = useState(false);
  const [placingContainerId, setPlacingContainerId] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchQueue, setBatchQueue] = useState<Container[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchRotation, setBatchRotation] = useState(0);
  const [batchHistory, setBatchHistory] = useState<Array<{ containerId: string; x: number; y: number; rotation: number }>>([]);

  const { data: containersRaw } = useQuery<Container[]>({
    queryKey: ["/api/containers/list"],
  });

  const { data: siteSettings } = useQuery<SiteSettings>({
    queryKey: ["/api/site-settings"],
  });

  const containers = containersRaw || [];

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const layoutArray = Array.from(layouts.entries()).map(([id, pos]) => ({
        id,
        layoutX: pos.x,
        layoutY: pos.y,
        layoutRotation: pos.rotation,
      }));
      const unplacedIds = containers.filter((c) => !layouts.has(c.id)).map((c) => c.id);
      const allLayouts = [
        ...layoutArray,
        ...unplacedIds.map((id) => ({ id, layoutX: null, layoutY: null, layoutRotation: null })),
      ];
      await apiRequest("POST", "/api/containers/layouts", { layouts: allLayouts });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      setIsDirty(false);
      toast({ title: "Layout saved", description: `${layouts.size} container positions saved.` });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

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
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({ title: "Layout cleared", description: "All container positions have been reset." });
    },
  });

  const autoPlaceMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(wolfHollowMapUrl);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append("image", new File([blob], "wolf-hollow-site-map.png", { type: "image/png" }));
      const uploadRes = await fetch("/api/site-settings/background", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Background upload failed");

      const templateNames = getWolfHollowContainerNames();
      const bulkRes = await apiRequest("POST", "/api/containers/bulk-create", { names: templateNames });
      const bulkData = await bulkRes.json();
      const allContainers: Container[] = bulkData.containers;

      const template = getWolfHollowTemplate();
      const layoutArray: Array<{ id: string; layoutX: number | null; layoutY: number | null; layoutRotation: number | null }> = [];
      const newLayouts = new Map<string, { x: number; y: number; rotation: number }>();

      for (const c of allContainers) {
        const pos = template.get(c.name);
        if (pos) {
          layoutArray.push({ id: c.id, layoutX: pos.x, layoutY: pos.y, layoutRotation: pos.rotation });
          newLayouts.set(c.id, pos);
        } else {
          layoutArray.push({ id: c.id, layoutX: null, layoutY: null, layoutRotation: null });
        }
      }

      await apiRequest("POST", "/api/containers/layouts", { layouts: layoutArray });
      return { newLayouts, totalPlaced: newLayouts.size };
    },
    onSuccess: ({ newLayouts, totalPlaced }) => {
      setLayouts(newLayouts);
      setIsDirty(false);
      setInitialized(true);
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      toast({ title: "Layout applied", description: `Wolf Hollow site template applied — ${totalPlaced} containers placed.` });
    },
    onError: () => {
      toast({ title: "Auto-place failed", variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      if (batchMode && batchIndex < batchQueue.length) {
        const container = batchQueue[batchIndex];
        setLayouts((prev) => {
          const next = new Map(prev);
          next.set(container.id, { x, y, rotation: batchRotation });
          return next;
        });
        setBatchHistory((prev) => [...prev, { containerId: container.id, x, y, rotation: batchRotation }]);
        setBatchIndex((prev) => prev + 1);
        setIsDirty(true);
        return;
      }

      if (placingContainerId) {
        setLayouts((prev) => {
          const next = new Map(prev);
          const existing = next.get(placingContainerId);
          next.set(placingContainerId, { x, y, rotation: existing?.rotation ?? 0 });
          return next;
        });
        setSelectedContainerId(placingContainerId);
        setPlacingContainerId(null);
        setIsDirty(true);
      }
    },
    [placingContainerId, batchMode, batchIndex, batchQueue, batchRotation]
  );

  const handleBatchUndo = () => {
    if (batchHistory.length === 0) return;
    const last = batchHistory[batchHistory.length - 1];
    setLayouts((prev) => {
      const next = new Map(prev);
      next.delete(last.containerId);
      return next;
    });
    setBatchHistory((prev) => prev.slice(0, -1));
    setBatchIndex((prev) => Math.max(0, prev - 1));
  };

  const handleBatchSkip = () => {
    if (batchIndex < batchQueue.length) {
      setBatchIndex((prev) => prev + 1);
    }
  };

  const startBatchMode = () => {
    const sorted = [...containers].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const unplaced = sorted.filter((c) => !layouts.has(c.id));
    if (unplaced.length === 0) {
      toast({ title: "All containers already placed", description: "Clear the layout first to re-place containers." });
      return;
    }
    setBatchQueue(unplaced);
    setBatchIndex(0);
    setBatchHistory([]);
    setBatchRotation(0);
    setBatchMode(true);
    setPlacingContainerId(null);
    setSelectedContainerId(null);
  };

  const startBatchModeAll = () => {
    const sorted = [...containers].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setLayouts(new Map());
    setBatchQueue(sorted);
    setBatchIndex(0);
    setBatchHistory([]);
    setBatchRotation(0);
    setBatchMode(true);
    setPlacingContainerId(null);
    setSelectedContainerId(null);
    setIsDirty(true);
  };

  const finishBatchMode = () => {
    setBatchMode(false);
    setBatchQueue([]);
    setBatchIndex(0);
    setBatchHistory([]);
    if (layouts.size > 0) {
      toast({ title: "Batch placement done", description: `${layouts.size} containers positioned. Don't forget to save!` });
    }
  };

  const handleRemoveFromLayout = (containerId: string) => {
    setLayouts((prev) => {
      const next = new Map(prev);
      next.delete(containerId);
      return next;
    });
    if (selectedContainerId === containerId) setSelectedContainerId(null);
    setIsDirty(true);
  };

  const handleRotationChange = (containerId: string, rotation: number) => {
    setLayouts((prev) => {
      const next = new Map(prev);
      const existing = next.get(containerId);
      if (existing) {
        next.set(containerId, { ...existing, rotation });
      }
      return next;
    });
    setIsDirty(true);
  };

  const backgroundImage = siteSettings?.backgroundImage;
  const placedCount = layouts.size;
  const totalCount = containers.length;
  const unplacedContainers = containers.filter((c) => !layouts.has(c.id));
  const placedContainers = containers.filter((c) => layouts.has(c.id));

  const selectedLayout = selectedContainerId ? layouts.get(selectedContainerId) : null;
  const selectedContainer = selectedContainerId ? containers.find((c) => c.id === selectedContainerId) : null;

  const currentBatchContainer = batchMode && batchIndex < batchQueue.length ? batchQueue[batchIndex] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Site Layout Editor
        </CardTitle>
        <CardDescription>
          Upload your site photo and place containers where they belong. Use "Batch Place" to click-and-place containers one by one in order.
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoPlaceMutation.mutate()}
            disabled={autoPlaceMutation.isPending}
            data-testid="button-auto-place"
          >
            {autoPlaceMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Auto-place (Wolf Hollow)
          </Button>
          {!batchMode && backgroundImage && (
            <Button
              variant="default"
              size="sm"
              onClick={startBatchMode}
              data-testid="button-batch-place"
            >
              <Mouse className="h-4 w-4 mr-2" />
              Batch Place (Unplaced)
            </Button>
          )}
          {!batchMode && backgroundImage && containers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={startBatchModeAll}
              data-testid="button-batch-place-all"
            >
              <Mouse className="h-4 w-4 mr-2" />
              Batch Place (All)
            </Button>
          )}
          {backgroundImage && !batchMode && (
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
          {isDirty && !batchMode && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-layout"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Layout
            </Button>
          )}
          {placedCount > 0 && !batchMode && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => clearAllLayoutsMutation.mutate()}
              disabled={clearAllLayoutsMutation.isPending}
              data-testid="button-clear-layout"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {batchMode && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mouse className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Batch Placement Mode</span>
                <Badge variant="secondary" data-testid="text-batch-progress">
                  {batchIndex}/{batchQueue.length}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleBatchUndo} disabled={batchHistory.length === 0} data-testid="button-batch-undo">
                  <Undo2 className="h-3 w-3 mr-1" /> Undo
                </Button>
                <Button variant="outline" size="sm" onClick={handleBatchSkip} disabled={!currentBatchContainer} data-testid="button-batch-skip">
                  <SkipForward className="h-3 w-3 mr-1" /> Skip
                </Button>
                {isDirty && (
                  <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-batch-save">
                    {saveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                    Save
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={finishBatchMode} data-testid="button-batch-finish">
                  <Check className="h-3 w-3 mr-1" /> Done
                </Button>
              </div>
            </div>

            {currentBatchContainer ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Next:</span>
                  <Badge variant="default" className="text-sm font-mono animate-pulse" data-testid="text-batch-current">
                    {currentBatchContainer.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Click on the image to place it</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs text-muted-foreground">Rotation: {batchRotation}°</Label>
                  <Slider
                    value={[batchRotation]}
                    onValueChange={([v]) => setBatchRotation(v)}
                    min={0}
                    max={359}
                    step={1}
                    className="w-32"
                    data-testid="slider-batch-rotation"
                  />
                  <div className="flex gap-0.5">
                    {[0, 90, 180, 270, 325].map((deg) => (
                      <button
                        key={deg}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${batchRotation === deg ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted-foreground/20 text-muted-foreground"}`}
                        onClick={() => setBatchRotation(deg)}
                        data-testid={`button-batch-rotation-${deg}`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                All containers in queue have been placed! Click "Save" to keep the positions, or "Done" to exit.
              </div>
            )}

            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${batchQueue.length > 0 ? (batchIndex / batchQueue.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" data-testid="text-placed-count">
                {placedCount}/{totalCount} placed
              </Badge>
              {placingContainerId && !batchMode && (
                <Badge variant="default" className="animate-pulse" data-testid="text-placing-indicator">
                  Click on the image to place {containers.find((c) => c.id === placingContainerId)?.name}
                </Badge>
              )}
            </div>

            <div
              ref={canvasRef}
              className="relative border border-border rounded-lg overflow-hidden"
              style={{
                height: "500px",
                cursor: (placingContainerId || (batchMode && currentBatchContainer)) ? "crosshair" : "default",
                background: backgroundImage
                  ? `url(${backgroundImage}) center/contain no-repeat`
                  : "linear-gradient(135deg, hsl(220, 15%, 8%) 0%, hsl(220, 12%, 11%) 50%, hsl(220, 15%, 8%) 100%)",
              }}
              onClick={handleCanvasClick}
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

              {Array.from(layouts.entries()).map(([id, pos]) => {
                const container = containers.find((c) => c.id === id);
                if (!container) return null;
                const isSelected = selectedContainerId === id;
                return (
                  <div
                    key={id}
                    className="absolute"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
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
                        if (!batchMode) {
                          setSelectedContainerId(id);
                          setPlacingContainerId(null);
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

          {!batchMode && (
            <div className="w-64 flex-shrink-0 space-y-3">
              {selectedContainer && selectedLayout && (
                <Card className="border-primary">
                  <CardHeader className="py-3 px-3">
                    <CardTitle className="text-sm">{selectedContainer.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Rotation ({Math.round(selectedLayout.rotation)}°)</Label>
                      <Slider
                        value={[selectedLayout.rotation]}
                        onValueChange={([v]) => handleRotationChange(selectedContainer.id, v)}
                        min={0}
                        max={359}
                        step={1}
                        className="mt-1"
                        data-testid={`slider-rotation-${selectedContainer.id}`}
                      />
                      <div className="flex gap-1 mt-1">
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                          <button
                            key={deg}
                            className="text-[9px] px-1 py-0.5 rounded bg-muted hover:bg-muted-foreground/20 text-muted-foreground"
                            onClick={() => handleRotationChange(selectedContainer.id, deg)}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          setPlacingContainerId(selectedContainer.id);
                          setSelectedContainerId(null);
                        }}
                        data-testid={`button-reposition-${selectedContainer.id}`}
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        Reposition
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-400"
                        onClick={() => handleRemoveFromLayout(selectedContainer.id)}
                        data-testid={`button-remove-container-${selectedContainer.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Unplaced ({unplacedContainers.length})
                </Label>
                <div className="max-h-[250px] overflow-y-auto space-y-1">
                  {unplacedContainers.map((c) => (
                    <button
                      key={c.id}
                      className={`
                        w-full text-left px-2 py-1.5 rounded text-xs font-mono
                        transition-all
                        ${placingContainerId === c.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 hover:bg-muted text-foreground"
                        }
                      `}
                      onClick={() => {
                        setPlacingContainerId(placingContainerId === c.id ? null : c.id);
                        setSelectedContainerId(null);
                      }}
                      data-testid={`button-place-${c.id}`}
                    >
                      <MapPin className="h-3 w-3 inline mr-1" />
                      {c.name}
                    </button>
                  ))}
                  {unplacedContainers.length === 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      All containers placed
                    </p>
                  )}
                </div>
              </div>

              {placedContainers.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground font-semibold">
                    Placed ({placedContainers.length})
                  </Label>
                  <div className="max-h-[150px] overflow-y-auto space-y-1">
                    {placedContainers.map((c) => (
                      <button
                        key={c.id}
                        className={`
                          w-full text-left px-2 py-1.5 rounded text-xs font-mono
                          transition-all
                          ${selectedContainerId === c.id
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-green-900/20 hover:bg-green-900/30 text-green-400"
                          }
                        `}
                        onClick={() => {
                          setSelectedContainerId(selectedContainerId === c.id ? null : c.id);
                          setPlacingContainerId(null);
                        }}
                        data-testid={`button-select-placed-${c.id}`}
                      >
                        <Check className="h-3 w-3 inline mr-1" />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
