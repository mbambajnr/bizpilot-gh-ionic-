import React, { useState, useEffect } from 'react';
import {
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonText,
} from '@ionic/react';

interface PhoneInputFieldProps {
  label: string;
  value: string;
  onPhoneChange: (fullPhone: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  placeholder?: string;
  helperText?: string;
}

interface CountryData {
  code: string;
  country: string;
  flag: string;
  len: number[]; // Expected lengths of local number
}

const COUNTRIES: CountryData[] = [
  {"code": "+233", "country": "Ghana", "flag": "🇬🇭", "len": [9, 10]},
  {"code": "+234", "country": "Nigeria", "flag": "🇳🇬", "len": [10, 11]},
  {"code": "+254", "country": "Kenya", "flag": "🇰🇪", "len": [9, 10]},
  {"code": "+27", "country": "South Africa", "flag": "🇿🇦", "len": [9]},
  {"code": "+213", "country": "Algeria", "flag": "🇩🇿", "len": [9]},
  {"code": "+244", "country": "Angola", "flag": "🇦🇴", "len": [9]},
  {"code": "+229", "country": "Benin", "flag": "🇧🇯", "len": [8, 10]},
  {"code": "+267", "country": "Botswana", "flag": "🇧🇼", "len": [7, 8]},
  {"code": "+226", "country": "Burkina Faso", "flag": "🇧🇫", "len": [8]},
  {"code": "+257", "country": "Burundi", "flag": "🇧🇮", "len": [8]},
  {"code": "+238", "country": "Cabo Verde", "flag": "🇨🇻", "len": [7]},
  {"code": "+237", "country": "Cameroon", "flag": "🇨🇲", "len": [9]},
  {"code": "+236", "country": "Central African Republic", "flag": "🇨🇫", "len": [8]},
  {"code": "+235", "country": "Chad", "flag": "🇹🇩", "len": [8]},
  {"code": "+269", "country": "Comoros", "flag": "🇰🇲", "len": [7]},
  {"code": "+242", "country": "Congo (Brazzaville)", "flag": "🇨🇬", "len": [9]},
  {"code": "+243", "country": "Congo (Kinshasa)", "flag": "🇨🇩", "len": [9]},
  {"code": "+253", "country": "Djibouti", "flag": "🇩🇯", "len": [8]},
  {"code": "+20", "country": "Egypt", "flag": "🇪🇬", "len": [10, 11]},
  {"code": "+240", "country": "Equatorial Guinea", "flag": "🇬🇶", "len": [9]},
  {"code": "+291", "country": "Eritrea", "flag": "🇪🇷", "len": [7]},
  {"code": "+268", "country": "Eswatini", "flag": "🇸🇿", "len": [8]},
  {"code": "+251", "country": "Ethiopia", "flag": "🇪🇹", "len": [9]},
  {"code": "+241", "country": "Gabon", "flag": "🇬🇦", "len": [8, 9]},
  {"code": "+220", "country": "Gambia", "flag": "🇬🇲", "len": [7]},
  {"code": "+224", "country": "Guinea", "flag": "🇬🇳", "len": [9]},
  {"code": "+245", "country": "Guinea-Bissau", "flag": "🇬🇼", "len": [7, 9]},
  {"code": "+225", "country": "Ivory Coast", "flag": "🇨🇮", "len": [10]},
  {"code": "+266", "country": "Lesotho", "flag": "🇱🇸", "len": [8]},
  {"code": "+231", "country": "Liberia", "flag": "🇱🇷", "len": [7, 9]},
  {"code": "+218", "country": "Libya", "flag": "🇱🇾", "len": [9]},
  {"code": "+261", "country": "Madagascar", "flag": "🇲🇬", "len": [9]},
  {"code": "+265", "country": "Malawi", "flag": "🇲🇼", "len": [7, 9]},
  {"code": "+223", "country": "Mali", "flag": "🇲🇱", "len": [8]},
  {"code": "+222", "country": "Mauritania", "flag": "🇲🇷", "len": [8]},
  {"code": "+230", "country": "Mauritius", "flag": "🇲🇺", "len": [7, 8]},
  {"code": "+212", "country": "Morocco", "flag": "🇲🇦", "len": [9]},
  {"code": "+258", "country": "Mozambique", "flag": "🇲🇿", "len": [8, 9]},
  {"code": "+264", "country": "Namibia", "flag": "🇳🇦", "len": [9]},
  {"code": "+227", "country": "Niger", "flag": "🇳🇪", "len": [8]},
  {"code": "+250", "country": "Rwanda", "flag": "🇷🇼", "len": [9]},
  {"code": "+239", "country": "São Tomé and Príncipe", "flag": "🇸🇹", "len": [7]},
  {"code": "+221", "country": "Senegal", "flag": "🇸🇳", "len": [9]},
  {"code": "+248", "country": "Seychelles", "flag": "🇸🇨", "len": [7]},
  {"code": "+232", "country": "Sierra Leone", "flag": "🇸🇱", "len": [8, 9]},
  {"code": "+252", "country": "Somalia", "flag": "🇸🇴", "len": [9]},
  {"code": "+211", "country": "South Sudan", "flag": "🇸🇸", "len": [9]},
  {"code": "+249", "country": "Sudan", "flag": "🇸🇩", "len": [9]},
  {"code": "+255", "country": "Tanzania", "flag": "🇹🇿", "len": [9, 10]},
  {"code": "+228", "country": "Togo", "flag": "🇹🇬", "len": [8]},
  {"code": "+216", "country": "Tunisia", "flag": "🇹🇳", "len": [8]},
  {"code": "+256", "country": "Uganda", "flag": "🇺🇬", "len": [9]},
  {"code": "+260", "country": "Zambia", "flag": "🇿🇲", "len": [9]},
  {"code": "+263", "country": "Zimbabwe", "flag": "🇿🇼", "len": [9, 10]},
  {"code": "+1", "country": "USA", "flag": "🇺🇸", "len": [10]},
  {"code": "+44", "country": "UK", "flag": "🇬🇧", "len": [10]},
  {"code": "+86", "country": "China", "flag": "🇨🇳", "len": [11]},
  {"code": "+971", "country": "UAE", "flag": "🇦🇪", "len": [9]},
  {"code": "+33", "country": "France", "flag": "🇫🇷", "len": [9]},
  {"code": "+49", "country": "Germany", "flag": "🇩🇪", "len": [10, 11]},
  {"code": "+91", "country": "India", "flag": "🇮🇳", "len": [10]}
];

const PhoneInputField: React.FC<PhoneInputFieldProps> = ({
  label,
  value,
  onPhoneChange,
  onValidityChange,
  placeholder = 'e.g. 02XXXXXXXX',
  helperText,
}) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState(COUNTRIES[0].code);
  const [localNumber, setLocalNumber] = useState('');
  const [isTouched, setIsTouched] = useState(false);

  useEffect(() => {
    if (value) {
      const matches = COUNTRIES.filter(c => value.startsWith(c.code))
                               .sort((a,b) => b.code.length - a.code.length);
      
      if (matches.length > 0) {
        setSelectedCountryCode(matches[0].code);
        setLocalNumber(value.slice(matches[0].code.length));
      } else {
        setLocalNumber(value);
      }
    }
  }, []);

  const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode) || COUNTRIES[0];
  const isValidLength = localNumber.length === 0 || selectedCountry.len.includes(localNumber.length);

  useEffect(() => {
    onValidityChange?.(isValidLength);
  }, [isValidLength, onValidityChange]);

  const handleCountryChange = (event: CustomEvent) => {
    const code = event.detail.value;
    setSelectedCountryCode(code);
    onPhoneChange(code + localNumber);
  };

  const handleNumberChange = (event: CustomEvent) => {
    const val = event.detail.value ?? '';
    const cleanVal = val.replace(/\D/g, '');
    setLocalNumber(cleanVal);
    onPhoneChange(selectedCountryCode + cleanVal);
  };

  const showError = isTouched && !isValidLength && localNumber.length > 0;

  return (
    <div className="phone-input-field">
      <IonLabel position="stacked" className={`phone-label ${showError ? 'label-error' : ''}`}>
        {label}
      </IonLabel>
      <div className="phone-input-row">
        <div className={`phone-prefix-wrapper ${showError ? 'wrapper-error' : ''}`}>
          <IonSelect
            value={selectedCountryCode}
            interface="alert"
            interfaceOptions={{ header: 'Select Country Code' }}
            onIonChange={handleCountryChange}
            className="phone-prefix-select"
            toggleIcon=""
          >
            {COUNTRIES.map(c => (
              <IonSelectOption key={`${c.code}-${c.country}`} value={c.code}>
                {c.flag} {c.country} ({c.code})
              </IonSelectOption>
            ))}
          </IonSelect>
          <div className="phone-prefix-display">
            {selectedCountry.flag} {selectedCountry.code}
          </div>
        </div>
        
        <div className={`phone-number-wrapper ${showError ? 'wrapper-error' : ''}`}>
          <IonInput
            type="tel"
            value={localNumber}
            placeholder={placeholder}
            onIonInput={handleNumberChange}
            onIonBlur={() => setIsTouched(true)}
            className="phone-number-input"
          />
        </div>
      </div>
      
      {showError && (
        <IonText color="danger" className="validation-error">
          Invalid length. {selectedCountry.country} numbers should be {selectedCountry.len.join(' or ')} digits.
        </IonText>
      )}
      
      {!showError && helperText && <p className="phone-helper-text">{helperText}</p>}
      
      <style>{`
        .phone-input-field {
          width: 100%;
          margin-bottom: 4px;
        }
        .phone-label {
          color: var(--text-secondary);
          font-weight: 700;
          font-size: 0.85rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          margin-bottom: 8px;
          display: block;
          padding-left: 2px;
          transition: color 0.2s ease;
        }
        .label-error {
          color: var(--ion-color-danger);
        }
        .phone-input-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .phone-prefix-wrapper,
        .phone-number-wrapper {
          background: var(--surface-input);
          border: 1.5px solid var(--border-strong);
          border-radius: 8px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .wrapper-error {
          border-color: var(--ion-color-danger) !important;
          box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1) !important;
        }
        .phone-prefix-wrapper {
          position: relative;
          flex: 0 0 100px;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .phone-prefix-wrapper:focus-within {
          border-color: var(--ion-color-primary);
          box-shadow: 0 0 0 3px rgba(46, 139, 87, 0.1);
        }
        .phone-prefix-select {
          position: absolute;
          width: 100%;
          height: 100%;
          opacity: 0;
          z-index: 2;
        }
        .phone-prefix-display {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--ion-text-color);
          display: flex;
          align-items: center;
          gap: 6px;
          pointer-events: none;
        }
        .phone-number-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
        }
        .phone-number-wrapper:focus-within {
          border-color: var(--ion-color-primary);
          box-shadow: 0 0 0 3px rgba(46, 139, 87, 0.1);
        }
        .phone-number-input {
          --padding-start: 14px;
          --color: var(--ion-text-color);
          --placeholder-color: var(--text-muted);
          font-size: 1rem;
          font-weight: 600;
        }
        .phone-helper-text,
        .validation-error {
          font-size: 0.75rem;
          margin: 6px 4px 0;
          line-height: 1.4;
          display: block;
        }
        .phone-helper-text {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};

export default PhoneInputField;
