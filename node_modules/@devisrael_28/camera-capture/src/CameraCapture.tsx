import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, X, RotateCcw, Check, Video, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  /** "photo" for still capture, "video" for video recording */
  mode?: "photo" | "video";
}

export default function CameraCapture({
  onCapture,
  onClose,
  title = "Take Photo",
  description = "Position your camera and take a clear photo",
  mode = "photo",
}: CameraCaptureProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const startCamera = useCallback(
    async (overrideFacingMode?: "user" | "environment") => {
      const currentFacingMode = overrideFacingMode || facingMode;
      setIsLoading(true);
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: mode === "video",
        };

        const mediaStream =
          await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
      } catch (error) {
        console.error("Error accessing camera:", error);
        setIsLoading(false);
        toast({
          title: "Camera Error",
          description:
            "Unable to access camera. Please check permissions and try again.",
          variant: "destructive",
        });
      }
    },
    [facingMode, toast, mode],
  );

  // Handle video stream assignment when stream is available
  useEffect(() => {
    if (stream && videoRef.current && !isStreaming) {
      const video = videoRef.current;
      video.srcObject = stream;

      const handleCanPlay = () => {
        setIsLoading(false);
        setIsStreaming(true);
      };

      video.addEventListener("canplay", handleCanPlay, { once: true });

      const playVideo = async () => {
        try {
          await video.play();
        } catch (playError) {
          setTimeout(async () => {
            try {
              await video.play();
            } catch (retryError) {
              setIsLoading(false);
            }
          }, 100);
        }
      };

      playVideo();

      return () => {
        video.removeEventListener("canplay", handleCanPlay);
      };
    }
  }, [stream, isStreaming]);

  const stopCamera = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsStreaming(false);
    setIsLoading(false);
    setIsRecording(false);
    setRecordingDuration(0);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage(imageUrl);
          stopCamera();
        }
      },
      "image/jpeg",
      0.8,
    );
  }, [stopCamera]);

  const confirmPhoto = useCallback(() => {
    if (!capturedImage) return;

    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
        onClose();
      })
      .catch((error) => {
        console.error("Error processing photo:", error);
        toast({
          title: "Error",
          description: "Failed to process photo. Please try again.",
          variant: "destructive",
        });
      });
  }, [capturedImage, onCapture, onClose, toast]);

  const retakePhoto = useCallback(() => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
      setCapturedImage(null);
    }
    if (capturedVideo) {
      URL.revokeObjectURL(capturedVideo);
      setCapturedVideo(null);
    }
    recordedChunksRef.current = [];
    startCamera();
  }, [capturedImage, capturedVideo, startCamera]);

  const startRecording = useCallback(() => {
    if (!stream) return;

    recordedChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setCapturedVideo(url);
        stopCamera();
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      toast({
        title: "Recording Error",
        description:
          "Unable to start recording. Your browser may not support this feature.",
        variant: "destructive",
      });
    }
  }, [stream, stopCamera, toast]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const confirmVideo = useCallback(() => {
    if (!capturedVideo) return;

    fetch(capturedVideo)
      .then((res) => res.blob())
      .then((blob) => {
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `video-${Date.now()}.${ext}`, {
          type: blob.type,
        });
        onCapture(file);
        onClose();
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to process video. Please try again.",
          variant: "destructive",
        });
      });
  }, [capturedVideo, onCapture, onClose, toast]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const switchCamera = useCallback(async () => {
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    const wasStreaming = isStreaming;

    if (wasStreaming) {
      stopCamera();
    }

    setFacingMode(newFacingMode);

    if (wasStreaming) {
      startCamera(newFacingMode);
    }
  }, [facingMode, isStreaming, stopCamera, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
      if (capturedVideo) {
        URL.revokeObjectURL(capturedVideo);
      }
    };
  }, [capturedImage, capturedVideo, stopCamera]);

  const hasCaptured = mode === "video" ? !!capturedVideo : !!capturedImage;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-sm sm:max-w-lg bg-white max-h-[95vh] overflow-auto">
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Camera View */}
            <div
              className="relative bg-background rounded-lg overflow-hidden"
              style={{ aspectRatio: "4/3" }}
            >
              {!stream && !isLoading && !hasCaptured && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 sm:space-y-4">
                  {mode === "video" ? (
                    <Video className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                  ) : (
                    <Camera className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                  )}
                  <Button
                    onClick={() => startCamera()}
                    className="bg-primary hover:bg-primary text-sm"
                  >
                    {mode === "video" ? (
                      <>
                        <Video className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Start Camera
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Start Camera
                      </>
                    )}
                  </Button>
                </div>
              )}

              {isLoading && !hasCaptured && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 sm:space-y-4">
                  <Camera className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground animate-pulse" />
                  <p className="text-sm text-muted-foreground">
                    Starting camera...
                  </p>
                </div>
              )}

              {/* Live camera feed */}
              {(stream || isLoading) && !hasCaptured && (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                    controls={false}
                    style={{ objectFit: "cover", backgroundColor: "black" }}
                  />
                  {isStreaming && (
                    <div className="absolute inset-0 border-2 border-white/20 rounded-lg">
                      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={switchCamera}
                          className="bg-black/50 text-white hover:bg-black/70"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        {isRecording && (
                          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-white text-xs font-mono font-medium">
                              {formatDuration(recordingDuration)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Photo preview */}
              {capturedImage && mode === "photo" && (
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Video preview */}
              {capturedVideo && mode === "video" && (
                <video
                  ref={previewVideoRef}
                  src={capturedVideo}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  style={{ objectFit: "cover", backgroundColor: "black" }}
                />
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
              {isStreaming && !isRecording && !hasCaptured && (
                <>
                  <Button
                    variant="outline"
                    onClick={stopCamera}
                    className="w-full sm:w-auto text-sm"
                  >
                    Cancel
                  </Button>
                  {mode === "video" ? (
                    <Button
                      onClick={startRecording}
                      className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto text-sm"
                    >
                      <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-white mr-2" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button
                      onClick={capturePhoto}
                      className="bg-primary hover:bg-primary w-full sm:w-auto text-sm"
                    >
                      <Camera className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Capture Photo
                    </Button>
                  )}
                </>
              )}

              {isRecording && (
                <Button
                  onClick={stopRecording}
                  className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto text-sm"
                >
                  <Square className="mr-2 h-3 w-3 sm:h-4 sm:w-4 fill-white" />
                  Stop Recording ({formatDuration(recordingDuration)})
                </Button>
              )}

              {capturedImage && mode === "photo" && (
                <>
                  <Button
                    variant="outline"
                    onClick={retakePhoto}
                    className="w-full sm:w-auto text-sm"
                  >
                    <RotateCcw className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Retake
                  </Button>
                  <Button
                    onClick={confirmPhoto}
                    className="bg-success hover:bg-success w-full sm:w-auto text-sm"
                  >
                    <Check className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Use Photo
                  </Button>
                </>
              )}

              {capturedVideo && mode === "video" && (
                <>
                  <Button
                    variant="outline"
                    onClick={retakePhoto}
                    className="w-full sm:w-auto text-sm"
                  >
                    <RotateCcw className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Retake
                  </Button>
                  <Button
                    onClick={confirmVideo}
                    className="bg-success hover:bg-success w-full sm:w-auto text-sm"
                  >
                    <Check className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Use Video
                  </Button>
                </>
              )}
            </div>

            {/* Help Text */}
            <div className="text-xs sm:text-sm text-muted-foreground text-center space-y-1 px-2">
              {mode === "video" ? (
                <>
                  <p>• Hold your device steady while recording</p>
                  <p>• Ensure good lighting for best quality</p>
                  <p>• Tap Stop to finish recording</p>
                </>
              ) : (
                <>
                  <p>• Hold your device steady when taking the photo</p>
                  <p>• Ensure good lighting for best results</p>
                  <p>• Make sure the subject is clearly visible</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
