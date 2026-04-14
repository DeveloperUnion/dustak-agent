'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { AddressPickerWidgetPart } from '@/types/messages';
import type { AddressComponents } from '@/lib/slots/types';

interface Props {
  part: AddressPickerWidgetPart;
  onSubmit: (address: string, components?: AddressComponents) => void;
  disabled?: boolean;
  createdAt?: number;
  showTail?: boolean;
}

function fmtTime(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Suggestion {
  placeId: string;
  description: string;
}

/** Google Places address_components から AddressComponents に変換 */
function parseGoogleComponents(
  components: google.maps.places.PlaceResult['address_components'],
  placeId?: string,
  location?: google.maps.LatLng | null,
): AddressComponents {
  const result: AddressComponents = {};
  if (placeId) result.placeId = placeId;
  if (location) {
    result.lat = location.lat();
    result.lng = location.lng();
  }
  for (const c of components ?? []) {
    const types = c.types;
    if (types.includes('postal_code')) result.postalCode = c.long_name;
    else if (types.includes('administrative_area_level_1')) result.prefecture = c.long_name;
    else if (types.includes('locality')) result.city = c.long_name;
    else if (types.includes('sublocality_level_1') || types.includes('ward')) result.ward = c.long_name;
    else if (types.includes('sublocality_level_2') || types.includes('sublocality_level_3'))
      result.town = (result.town ? result.town + '' : '') + c.long_name;
    else if (types.includes('premise') || types.includes('subpremise'))
      result.building = (result.building ? result.building + '' : '') + c.long_name;
  }
  return result;
}

export function AddressPickerWidget({
  part,
  onSubmit,
  disabled,
  createdAt,
  showTail = true,
}: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<AddressComponents | undefined>();
  const [buildingDetail, setBuildingDetail] = useState('');
  const [closed, setClosed] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const dummyDivRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Google Maps API のロード
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    setOptions({ key: apiKey, language: 'ja', region: 'JP' });

    Promise.all([importLibrary('places'), importLibrary('geocoding')]).then(() => {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      geocoderRef.current = new google.maps.Geocoder();
      if (dummyDivRef.current) {
        placesServiceRef.current = new google.maps.places.PlacesService(dummyDivRef.current);
      }
      setApiReady(true);
    });
  }, []);

  // オートコンプリート検索
  const searchPlaces = useCallback(
    (input: string) => {
      if (!autocompleteServiceRef.current || !sessionTokenRef.current || !input.trim()) {
        setSuggestions([]);
        return;
      }
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: 'jp' },
          sessionToken: sessionTokenRef.current,
          types: ['address'],
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(
              predictions.slice(0, 5).map((p) => ({
                placeId: p.place_id,
                description: p.description,
              })),
            );
          } else {
            setSuggestions([]);
          }
        },
      );
    },
    [],
  );

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedAddress('');
    setSelectedComponents(undefined);
    setBuildingDetail('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 300);
  };

  // 候補選択 → Place Details 取得
  const selectSuggestion = (suggestion: Suggestion) => {
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.placeId,
        fields: ['formatted_address', 'address_components', 'geometry'],
        sessionToken: sessionTokenRef.current!,
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const address = place.formatted_address ?? suggestion.description;
          const components = parseGoogleComponents(
            place.address_components,
            suggestion.placeId,
            place.geometry?.location,
          );
          setSelectedAddress(address);
          setSelectedComponents(components);
          setQuery(address);
          setSuggestions([]);
          // セッショントークンをリフレッシュ
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      },
    );
  };

  // 現在地取得
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('お使いのブラウザは位置情報に対応していません');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (geocoderRef.current) {
          geocoderRef.current.geocode({ location: latlng }, (results, status) => {
            setGeoLoading(false);
            if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
              const r = results[0];
              const address = r.formatted_address ?? '';
              const components = parseGoogleComponents(
                r.address_components,
                r.place_id,
                r.geometry?.location,
              );
              setSelectedAddress(address);
              setSelectedComponents(components);
              setQuery(address);
              setSuggestions([]);
            } else {
              setGeoError('住所の取得に失敗しました');
            }
          });
        } else {
          setGeoLoading(false);
          setGeoError('Google Maps API が読み込まれていません');
        }
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('位置情報の使用が許可されていません');
        } else {
          setGeoError('現在地の取得に失敗しました');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = () => {
    // オートコンプリート候補選択 or 現在地取得で確定された住所のみ受け付ける
    if (!selectedAddress) return;
    const detail = buildingDetail.trim();
    const fullAddress = detail ? `${selectedAddress} ${detail}` : selectedAddress;
    const components = selectedComponents
      ? { ...selectedComponents, ...(detail ? { building: detail } : {}) }
      : undefined;
    setClosed(true);
    onSubmit(fullAddress, components);
  };

  const isReady = apiReady || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className={`flex justify-start px-5 ${showTail ? 'mt-4' : 'mt-1'}`}>
      {/* PlacesService に必要なダミー要素 */}
      <div ref={dummyDivRef} style={{ display: 'none' }} />

      <div className="w-full max-w-[440px] dustalk-rise">
        {showTail && (
          <div className="flex items-center gap-2 mb-1.5 ml-1">
            <span className="w-1 h-1 rounded-full bg-[var(--brand)]" />
            <span className="eyebrow">DUSTALK</span>
          </div>
        )}
        <div
          className={`relative bg-[var(--surface)] rounded-[14px] rounded-tl-[4px] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_2px_18px_-8px_rgba(11,30,74,0.18)] border border-[var(--line)] ${
            closed ? 'opacity-60' : ''
          }`}
        >
          <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-[var(--brand)]/85" />

          {part.prompt && (
            <div className="text-[14.5px] leading-[1.7] text-[var(--text)] mb-3 pl-1.5">
              {part.prompt}
            </div>
          )}

          <div className="pl-1.5 space-y-3">
            {/* 検索入力 */}
            <div className="relative">
              <div className="flex items-center gap-2 border border-[var(--line-strong)] rounded-[10px] px-3 py-2.5 bg-[var(--paper)] focus-within:border-[var(--brand)] transition-colors">
                <svg
                  className="flex-shrink-0 w-4 h-4 text-[var(--ink-mute)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedAddress) {
                      handleSubmit();
                    }
                  }}
                  placeholder="住所を検索..."
                  disabled={disabled || closed}
                  className="flex-1 min-w-0 text-[13.5px] text-[var(--text)] placeholder:text-[var(--ink-mute)] bg-transparent focus:outline-none"
                />
              </div>

              {/* オートコンプリート候補 */}
              {suggestions.length > 0 && !closed && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--line)] rounded-[10px] shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s.placeId}
                      type="button"
                      onClick={() => selectSuggestion(s)}
                      className="w-full text-left px-3 py-2.5 text-[13px] text-[var(--text)] hover:bg-[var(--brand)]/[0.04] border-b border-[var(--line)] last:border-b-0 transition-colors"
                    >
                      {s.description}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 現在地ボタン */}
            {isReady && !closed && (
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={disabled || geoLoading}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] border border-[var(--line-strong)] text-[13px] text-[var(--brand)] hover:bg-[var(--brand)]/[0.03] hover:border-[var(--brand)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="flex-shrink-0 w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="12" cy="12" r="8" />
                </svg>
                {geoLoading ? '取得中...' : '現在地を使用'}
              </button>
            )}

            {/* エラーメッセージ */}
            {geoError && (
              <div className="text-[12px] text-red-500 px-1">{geoError}</div>
            )}

            {/* 選択された住所の表示 + 建物名・部屋番号入力 */}
            {selectedAddress && !closed && (
              <>
                <div className="bg-[var(--brand)]/[0.04] rounded-[10px] px-3 py-2.5 border border-[var(--brand)]/20">
                  <div className="text-[11px] text-[var(--ink-mute)] mb-0.5">選択された住所</div>
                  <div className="text-[13.5px] text-[var(--text)] leading-[1.6]">
                    {selectedAddress}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--ink-mute)] mb-1 px-1">建物名・部屋番号（任意）</div>
                  <input
                    type="text"
                    value={buildingDetail}
                    onChange={(e) => setBuildingDetail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit();
                    }}
                    placeholder="例: ダストークマンション 301号室"
                    disabled={disabled}
                    className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--line-strong)] bg-[var(--paper)] text-[13.5px] text-[var(--text)] placeholder:text-[var(--ink-mute)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                  />
                </div>
              </>
            )}

            {/* アクションボタン */}
            {!closed && (
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={disabled || !selectedAddress}
                  className="px-5 py-1.5 rounded-full text-[12px] tracking-[0.18em] uppercase bg-[var(--brand)] text-white disabled:bg-[var(--ink-mute)]/40 disabled:cursor-not-allowed transition-all hover:brightness-110"
                >
                  確定
                </button>
              </div>
            )}
          </div>

          {createdAt !== undefined && (
            <div className="flex justify-end mt-2">
              <span className="text-[10px] tracking-wider text-[var(--ink-mute)] uppercase">
                {fmtTime(createdAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
