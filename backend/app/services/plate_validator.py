"""Indian License Plate Validator & Character Sanitizer for NexTrAI.

Enforces Ministry of Road Transport and Highways (MoRTH) High Security
Registration Plates (HSRP) format rules and applies position-aware OCR ambiguity resolution.
"""

import re
from typing import Tuple, Optional, Dict, Any

# Indian States & Union Territories Valid 2-Letter RTO Codes
VALID_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CH", "CG", "CH", "DD", "DL", "DN", "GA",
    "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN",
    "MP", "MZ", "NL", "OD", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK",
    "UP", "WB"
}

# Standard Indian Registration Plate Regex:
# e.g., TS09EA1234, AP28BK5678, DL1CAB9999, MH02CB4321, KA01AB1234
STANDARD_PLATE_REGEX = re.compile(
    r"^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{4})$"
)

# Bharat (BH) Series Format: e.g., 22BH1234AA
BH_SERIES_REGEX = re.compile(
    r"^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$"
)

# Ambiguity mapping dictionaries
CHAR_TO_DIGIT = {
    "O": "0", "D": "0", "Q": "0",
    "I": "1", "L": "1", "T": "1",
    "Z": "2",
    "E": "3",
    "A": "4",
    "S": "5",
    "G": "6",
    "B": "8",
}

DIGIT_TO_CHAR = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "3": "E",
    "4": "A",
    "5": "S",
    "6": "G",
    "8": "B",
}

class PlateValidator:
    """Sanitizes raw OCR output and validates against Indian motor vehicle plate standards."""

    @staticmethod
    def sanitize_raw_text(raw_text: str) -> str:
        """Removes spaces, hyphens, and non-alphanumeric noise."""
        if not raw_text:
            return ""
        # Uppercase and strip non-alphanumeric
        cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_text).upper()
        # Remove common country identifiers if prefixed like 'IND'
        if cleaned.startswith("IND") and len(cleaned) > 7:
            cleaned = cleaned[3:]
        return cleaned

    @classmethod
    def correct_ambiguities(cls, text: str) -> str:
        """
        Applies positional character correction based on standard Indian plate pattern:
        [0-1]: State Code (Letters) OR Year for BH series (Digits)
        [2-3]: RTO Code (Digits) OR 'BH' (Letters)
        [4 to len-4]: Series (Letters) OR 4-digit number for BH series (Digits)
        [-4 to end]: Unique Registration Number (Digits) OR 1-2 letters for BH series
        """
        if len(text) < 8 or len(text) > 11:
            return text

        chars = list(text)

        # Check if this resembles a Bharat (BH) series: e.g. 22BH..., or index 2-3 is BH
        if len(text) >= 9 and text[2:4].upper() == "BH":
            for i in (0, 1):
                if chars[i] in CHAR_TO_DIGIT:
                    chars[i] = CHAR_TO_DIGIT[chars[i]]
            chars[2] = "B"
            chars[3] = "H"
            for i in range(4, min(8, len(chars))):
                if chars[i] in CHAR_TO_DIGIT:
                    chars[i] = CHAR_TO_DIGIT[chars[i]]
            for i in range(8, len(chars)):
                if chars[i] in DIGIT_TO_CHAR:
                    chars[i] = DIGIT_TO_CHAR[chars[i]]
            return "".join(chars)

        # Standard Indian HSRP Plate:
        # Positions 0 and 1 MUST be letters (State Code)
        for i in (0, 1):
            if chars[i] in DIGIT_TO_CHAR:
                chars[i] = DIGIT_TO_CHAR[chars[i]]

        # Position 2 and 3: RTO code (digits)
        if len(chars) >= 9:
            if chars[2] in CHAR_TO_DIGIT:
                chars[2] = CHAR_TO_DIGIT[chars[2]]
            if chars[3] in CHAR_TO_DIGIT and len(chars) >= 10:
                chars[3] = CHAR_TO_DIGIT[chars[3]]

        # Positions len-4, len-3, len-2, len-1 MUST be digits
        for i in range(len(chars) - 4, len(chars)):
            if chars[i] in CHAR_TO_DIGIT:
                chars[i] = CHAR_TO_DIGIT[chars[i]]

        return "".join(chars)

    @classmethod
    def validate(cls, raw_ocr_text: str, ocr_confidence: float = 0.0) -> Dict[str, Any]:
        """
        Validates whether raw text matches an authentic Indian vehicle registration plate.

        Returns:
            Dict containing:
                is_valid: bool
                plate_number: normalized string (e.g. 'TS09EA1234')
                formatted_plate: human-readable string (e.g. 'TS 09 EA 1234')
                state_code: state abbreviation (e.g. 'TS')
                state_name: state full name (e.g. 'Telangana')
                confidence: adjusted confidence score
                plate_type: 'STANDARD' or 'BH_SERIES'
        """
        cleaned = cls.sanitize_raw_text(raw_ocr_text)
        corrected = cls.correct_ambiguities(cleaned)

        # 1. Test Standard Plate
        std_match = STANDARD_PLATE_REGEX.match(corrected)
        if std_match:
            state, rto, series, number = std_match.groups()
            rto_padded = rto.zfill(2)
            normalized = f"{state}{rto_padded}{series}{number}"
            formatted = f"{state} {rto_padded} {series} {number}"

            is_valid_state = state in VALID_STATE_CODES
            confidence_boost = 0.10 if is_valid_state else -0.15
            final_conf = min(1.0, max(0.1, ocr_confidence + confidence_boost))

            return {
                "is_valid": is_valid_state,
                "plate_number": normalized,
                "formatted_plate": formatted,
                "state_code": state,
                "state_name": cls.get_state_name(state),
                "rto_code": rto_padded,
                "series": series,
                "registration_number": number,
                "confidence": round(final_conf, 3),
                "plate_type": "STANDARD_HSRP",
            }

        # 2. Test Bharat (BH) Series
        bh_match = BH_SERIES_REGEX.match(corrected)
        if bh_match:
            year, bh, number, series = bh_match.groups()
            normalized = f"{year}{bh}{number}{series}"
            formatted = f"{year} {bh} {number} {series}"
            return {
                "is_valid": True,
                "plate_number": normalized,
                "formatted_plate": formatted,
                "state_code": "BH",
                "state_name": "Bharat Series (All-India Central)",
                "rto_code": "BH",
                "series": series,
                "registration_number": number,
                "confidence": round(ocr_confidence, 3),
                "plate_type": "BH_SERIES",
            }

        # Invalid or partial match
        return {
            "is_valid": False,
            "plate_number": corrected,
            "formatted_plate": corrected,
            "state_code": corrected[:2] if len(corrected) >= 2 else "UNKNOWN",
            "state_name": "Unknown / Unresolved",
            "confidence": round(ocr_confidence, 3),
            "plate_type": "UNRESOLVED",
        }

    @staticmethod
    def get_state_name(code: str) -> str:
        state_names = {
            "TS": "Telangana",
            "AP": "Andhra Pradesh",
            "DL": "Delhi (NCT)",
            "MH": "Maharashtra",
            "KA": "Karnataka",
            "TN": "Tamil Nadu",
            "UP": "Uttar Pradesh",
            "HR": "Haryana",
            "GJ": "Gujarat",
            "WB": "West Bengal",
            "KL": "Kerala",
            "MP": "Madhya Pradesh",
            "RJ": "Rajasthan",
            "PB": "Punjab",
            "BR": "Bihar",
            "OD": "Odisha",
            "CH": "Chandigarh",
        }
        return state_names.get(code, f"State Code ({code})")

plate_validator = PlateValidator()
