"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface PlaceSuggestion {
  placeId: string;
  description: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
}

// ────────────────────────────────────────────────────────────
// Inner component (requires APIProvider ancestor)
// ────────────────────────────────────────────────────────────

function AddressAutocompleteInner({
  value,
  onChange,
  placeholder = "Enter your delivery address",
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const places = useMapsLibrary("places");

  // Create a session token when the library loads
  useEffect(() => {
    if (places) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, [places]);

  const handleSearch = useCallback(
    (query: string) => {
      onChange(query);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (query.trim().length < 3 || !places) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const service = new google.maps.places.AutocompleteService();
          const response = await service.getPlacePredictions({
            input: query,
            sessionToken: sessionTokenRef.current ?? undefined,
            types: ["address"],
          });

          const results: PlaceSuggestion[] = (response.predictions ?? []).map((p) => ({
            placeId: p.place_id,
            description: p.description,
          }));

          setSuggestions(results);
          setIsOpen(results.length > 0);
        } catch {
          setSuggestions([]);
          setIsOpen(false);
        }
        setIsLoading(false);
      }, 200);
    },
    [onChange, places],
  );

  const handleSelect = useCallback(
    async (suggestion: PlaceSuggestion) => {
      if (!places) {
        onChange(suggestion.description);
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      try {
        const service = new google.maps.places.PlacesService(document.createElement("div"));
        const details = await new Promise<google.maps.places.PlaceResult | null>((resolve) => {
          service.getDetails(
            {
              placeId: suggestion.placeId,
              fields: ["geometry", "formatted_address"],
              sessionToken: sessionTokenRef.current ?? undefined,
            },
            (result, status) => {
              resolve(status === google.maps.places.PlacesServiceStatus.OK ? result : null);
            },
          );
        });

        // Reset session token after getDetails (ends the session)
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

        if (details?.geometry?.location) {
          onChange(details.formatted_address ?? suggestion.description, {
            lat: details.geometry.location.lat(),
            lng: details.geometry.location.lng(),
          });
        } else {
          onChange(suggestion.description);
        }
      } catch {
        onChange(suggestion.description);
      }

      setSuggestions([]);
      setIsOpen(false);
    },
    [onChange, places],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="address-suggestions"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          id="address-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              role="option"
              aria-selected={false}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
              onClick={() => handleSelect(suggestion)}
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{suggestion.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Exported — self-contained with its own APIProvider
// ────────────────────────────────────────────────────────────

export function AddressAutocomplete(props: AddressAutocompleteProps) {
  return (
    <APIProvider apiKey={(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim()}>
      <AddressAutocompleteInner {...props} />
    </APIProvider>
  );
}
