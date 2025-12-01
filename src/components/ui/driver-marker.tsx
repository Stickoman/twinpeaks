"use client";

interface DriverMarkerProps {
  username: string;
  speed: number | null;
  heading: number | null;
  isSelected?: boolean;
}

export function DriverMarker({ username, speed, heading, isSelected }: DriverMarkerProps) {
  const initial = username.charAt(0).toUpperCase();
  const speedKmh = speed != null ? Math.round(speed * 3.6) : null;
  const isMoving = speedKmh != null && speedKmh > 2;

  return (
    <div className="relative flex flex-col items-center">
      {/* Speed badge */}
      {isMoving && (
        <div className="absolute -top-5 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap">
          {speedKmh} km/h
        </div>
      )}

      {/* Pulse ring */}
      <div className="absolute inset-0 m-auto size-10 animate-ping rounded-full bg-blue-500/20" />

      {/* Marker body */}
      <div
        className={`relative z-10 flex size-9 items-center justify-center rounded-full border-2 shadow-lg transition-transform ${
          isSelected ? "scale-125 border-blue-300 bg-blue-600" : "border-white bg-blue-500"
        }`}
      >
        <span className="text-sm font-bold text-white">{initial}</span>
      </div>

      {/* Heading arrow */}
      {isMoving && heading != null && (
        <div className="absolute -bottom-2 z-20" style={{ transform: `rotate(${heading}deg)` }}>
          <div className="size-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-blue-500" />
        </div>
      )}
    </div>
  );
}
