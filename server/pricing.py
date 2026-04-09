import logging

logger = logging.getLogger(__name__)

PRICING_CONFIG = {
    "yandexgpt-pro": {
        "input_per_1k": 0.42,
        "output_per_1k": 0.42,
    },
    "yandexgpt-lite": {
        "input_per_1k": 0.15,
        "output_per_1k": 0.15,
    },
    "ocr": {
        "page": 0.13,
        "table": 1.22
    }
}
