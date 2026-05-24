'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
} from '@react-google-maps/api';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

// ============================================================
// Types
// ============================================================

export interface GMapLocation {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

interface GMapComProps {
  value?: Partial<GMapLocation>;
  onChange: (location: GMapLocation) => void;
  height?: string;
}

const LIBRARIES: ('places')[] = ['places'];
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

/**
 * Google Maps component with:
 * - PlaceAutocompleteElement (new API, replaces deprecated Autocomplete)
 * - Draggable pin
 * - Single-finger map drag (gestureHandling: greedy)
 * - Returns lat, lng, name, address on change
 */
export function GMapCom({ value, onChange, height = '300px' }: GMapComProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPos, setMarkerPos] = useState<google.maps.LatLngLiteral>(
    value?.latitude && value?.longitude
      ? { lat: value.latitude, lng: value.longitude }
      : DEFAULT_CENTER
  );
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; text: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPos({ lat, lng });
      reverseGeocode(lat, lng);
    },
    []
  );

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPos({ lat, lng });
      reverseGeocode(lat, lng);
    },
    []
  );

  // Search using AutocompleteService (not deprecated)
  async function handleSearchChange(text: string) {
    setSearchText(text);
    if (!text.trim() || !isLoaded) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }

    const service = new google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      { input: text, sessionToken: sessionTokenRef.current },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions.map((p) => ({ placeId: p.place_id, text: p.description })));
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    );
  }

  function handleSelectPlace(placeId: string, text: string) {
    setSearchText(text);
    setShowSuggestions(false);
    sessionTokenRef.current = null;

    if (!map) return;

    const service = new google.maps.places.PlacesService(map);
    service.getDetails(
      { placeId, fields: ['geometry', 'name', 'formatted_address'] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setMarkerPos({ lat, lng });
          map.panTo({ lat, lng });
          map.setZoom(15);
          onChange({
            latitude: lat,
            longitude: lng,
            name: place.name || '',
            address: place.formatted_address || '',
          });
        }
      }
    );
  }

  function reverseGeocode(lat: number, lng: number) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        onChange({
          latitude: lat,
          longitude: lng,
          name: results[0].address_components?.[0]?.long_name || '',
          address: results[0].formatted_address || '',
        });
      } else {
        onChange({ latitude: lat, longitude: lng, name: '', address: '' });
      }
    });
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
        <p className="text-xs text-destructive">Failed to load Google Maps</p>
        <p className="text-[10px] text-muted-foreground mt-1">Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 flex items-center justify-center" style={{ height }}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Search with suggestions dropdown */}
      <div className="relative" ref={searchContainerRef}>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground z-10" />
        <Input
          ref={searchInputRef}
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Search location..."
          className="pl-8 text-xs h-8"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.placeId}
                type="button"
                onMouseDown={() => handleSelectPlace(s.placeId, s.text)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
              >
                <MapPin className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-foreground">{s.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-border" style={{ touchAction: 'pan-x pan-y' }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height, borderRadius: '8px' }}
          center={markerPos}
          zoom={value?.latitude ? 15 : 5}
          onLoad={onLoad}
          onClick={onMapClick}
          options={{
            gestureHandling: 'greedy',
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          <Marker
            position={markerPos}
            draggable
            onDragEnd={onMarkerDragEnd}
          />
        </GoogleMap>
      </div>

      {/* Selected location info */}
      {(value?.name || value?.address || (value?.latitude && value.latitude !== DEFAULT_CENTER.lat)) && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border p-2">
          <MapPin className="size-3.5 text-red-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            {value?.name && <p className="text-xs font-medium text-foreground truncate">{value.name}</p>}
            {value?.address && <p className="text-[10px] text-muted-foreground truncate">{value.address}</p>}
            <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
              {value?.latitude?.toFixed(6)}, {value?.longitude?.toFixed(6)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
