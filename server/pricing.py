from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

PRICING_CONFIG = {
    "yandexgpt-pro": {
        "input_per_1k": 0.60,
        "output_per_1k": 0.60,
    },
    "yandexgpt-lite": {
        "input_per_1k": 0.20,
        "output_per_1k": 0.20,
    },
    "ocr": {
        "page": 0.13,
        "table": 1.22
    }
}

@dataclass
class UsageStats:
    input_tokens: int = 0
    output_tokens: int = 0
    cost: float = 0.0
    details: dict = field(default_factory=dict)

    def add(self, input_tok: int, output_tok: int, model_key: str, label: str):
        self.input_tokens += input_tok
        self.output_tokens += output_tok
        
        config = PRICING_CONFIG.get(model_key, PRICING_CONFIG["yandexgpt-lite"])
        input_cost = (input_tok / 1000.0) * config["input_per_1k"]
        output_cost = (output_tok / 1000.0) * config["output_per_1k"]
        current_cost = round(input_cost + output_cost, 4)
        
        self.cost = round(self.cost + current_cost, 4)
        self.details[label] = {
            "tokens": input_tok + output_tok,
            "cost": round(current_cost, 2),
            "model": model_key
        }

    def add_ocr(self, pages: int, method: str, label: str):
        config = PRICING_CONFIG["ocr"]
        method_cost = config.get("table") if method == "ocr_table" else config.get("page")
        current_cost = round(pages * method_cost, 4)
        
        self.cost = round(self.cost + current_cost, 4)
        self.details[label] = {
            "pages": pages,
            "cost": round(current_cost, 2),
            "method": method
        }
        
    def merge(self, other: 'UsageStats', prefix=""):
        self.input_tokens += other.input_tokens
        self.output_tokens += other.output_tokens
        self.cost = round(self.cost + other.cost, 4)
        for k, v in other.details.items():
            self.details[f"{prefix}{k}" if prefix else k] = v
