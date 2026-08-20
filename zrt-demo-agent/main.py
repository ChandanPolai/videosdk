import asyncio
import json
import logging
import os
from pathlib import Path

import zeroruntime
from zeroruntime import Agent, AgentContext, EOUConfig, Pipeline, Room, function_tool, InterruptConfig
from zeroruntime.inference import TurnDetector, GoogleLLM, DeepgramSTT, CartesiaTTS, AICousticsDenoise
from zeroruntime.plugins import SileroVAD
from dotenv import load_dotenv

from instruction import INSTRUCTIONS

load_dotenv(override=True)


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
AGENT_ID = os.getenv("AGENT_ID", "ag_zzq3b1")
CALL_TRANSFER_TO = os.getenv("CALL_TRANSFER_TO", "")
SCRIPT_PATH = Path(__file__).with_name("script.json")
DEFAULT_OPENING = "Hello, kya main {name} ji se baat kar rahi hoon?"

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)


def load_script() -> dict:
    if SCRIPT_PATH.exists():
        try:
            data = json.loads(SCRIPT_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            logging.exception("Failed to read script.json")
    return {}


def resolve_customer_name(meta: dict) -> str:
    for key in ("name", "participantName", "customerName", "clientName"):
        value = meta.get(key)
        if value and str(value).strip():
            return str(value).strip()
    return "Sovan"


def render_opening(template: str, name: str) -> str:
    line = template or DEFAULT_OPENING
    return (
        line.replace("{name}", name)
        .replace("[Client Name]", name)
        .replace("[client name]", name)
    )


def build_pipeline() -> Pipeline:
    """Fresh pipeline per call; serve() builds one VoiceAgent + pipeline per session."""
    return Pipeline(
        stt=DeepgramSTT(model="nova-3-general", language="hi"),
        llm=GoogleLLM(model="gemini-2.5-flash", temperature=0.7, max_output_tokens=200),
        tts=CartesiaTTS(
            model="sonic-3.5",
            language="hi",
            voice="28ca2041-5dda-42df-8123-f58ea9c3da00",
        ),
        turn_detector=TurnDetector(),
       vad=SileroVAD(
            min_silence_duration=0.45,
            min_speech_duration=0.05,
        ),
        eou=EOUConfig(
            mode="DEFAULT",
            min_max_speech_wait_timeout=[0.0, 0.0],
            eou_certainty_threshold=0.8,
        ),
        interrupt=InterruptConfig(
            mode="HYBRID",
            interrupt_min_duration=0.2,
            interrupt_min_words=2,
        ),
        denoise=AICousticsDenoise(model_id="quail-vf-2.2-l-16khz"),
     )


class VoiceAgent(Agent):
    def __init__(self, ctx: AgentContext) -> None:
        meta = dict(ctx.metadata) if ctx.metadata else {}
        script = load_script()
        customer_name = resolve_customer_name(meta)
        instructions = (INSTRUCTIONS or "").replace("[Client Name]", customer_name)
        agent_name = (script.get("agent_name") or "Priya").strip()
        company = (script.get("company") or "Raaj Investment").strip()
        instructions = (
            f"Your name is {agent_name} from {company}. "
            f"The person you are calling is {customer_name}. Always address them as {customer_name} ji.\n\n"
            + instructions
        )

        super().__init__(
            agent_id=AGENT_ID,
            instructions=instructions,
            pipeline=build_pipeline(),
        )

        self.customer_info = {"name": customer_name}
        self.call_metadata = meta
        self.opening_line = render_opening(script.get("opening_line") or DEFAULT_OPENING, customer_name)
        self._history = None

    async def on_enter(self) -> None:
        await self.session.say(self.opening_line)

    @function_tool
    async def end_call(self, message: str) -> dict:
        """End the call when the complaint is registered, or the caller asks to hang up / says goodbye.

        message: The line spoken right before hangup. Warm, human, and matched to how the
        call went - never generic. Use the closing lines from Section 4 of the instructions:
            - Normal completion → "आपकी complaint register कर ली गई है. हम जल्द ही इसे resolve करेंगे. धन्यवाद, आपका दिन शुभ हो!"
            - Angry / frustrated caller → "मैं आपकी परेशानी समझ सकती हूँ. मैंने इसे priority पर mark कर दिया है. हमारी team आपसे जल्द contact करेगी. धन्यवाद."
            - Already complained → "जी, मैंने देख लिया है कि आपकी complaint पहले ही log हो चुकी है. हम उस पर काम कर रहे हैं. धन्यवाद."
            - Caller silent / busy → "लगता है आप अभी व्यस्त हैं. हम बाद में आपसे संपर्क करेंगे. धन्यवाद."
            - Wrong number → "ओह, माफ़ कीजियेगा. मैं अभी ये record update कर देती हूँ. धन्यवाद."
        """
        asyncio.create_task(self._announce_and_hangup(message))
        return {"status": "ending_call"}

    async def _announce_and_hangup(self, message: str) -> None:
        if not self.session:
            return
        await self.session.interrupt()
        await asyncio.sleep(0.5)  # let the interrupt land before the sign-off
        # say() only queues the utterance - await the handle so the goodbye
        # finishes playing before the call drops.
        handle = await self.session.say(message, interruptible=False)
        await handle
        await self.hangup()

    @function_tool
    async def transfer_call(self, message: str) -> dict:
        """Live-transfer the caller to a human advisor right now.

        Only use this after the caller has agreed to be connected immediately
        (not a callback later). If they instead want a callback, use
        request_advisor_callback.

        message: A short, warm heads-up line spoken before transferring, e.g.
            "Sure, main abhi aapko humare advisor se connect kar rahi hoon, ek second."
        """
        if not CALL_TRANSFER_TO:
            return {"status": "unavailable", "reason": "CALL_TRANSFER_TO is not configured"}
        asyncio.create_task(self._announce_and_transfer(message))
        return {"status": "transferring"}

    async def _announce_and_transfer(self, message: str) -> None:
        if not self.session:
            return
        await self.session.interrupt()
        await asyncio.sleep(0.5)  # let the interrupt land before the heads-up
        handle = await self.session.say(message, interruptible=False)
        await handle
        try:
            result = await self.session.transfer_call(CALL_TRANSFER_TO)
            logging.info("Transferred call to %s: %s", CALL_TRANSFER_TO, result)
        except Exception:
            logging.exception("transfer_call to %s failed", CALL_TRANSFER_TO)
            await self.session.say(
                "Maaf kijiye, transfer abhi possible nahi ho paaya. "
                "Main aapki advisor callback request note kar leta/leti hoon.",
                interruptible=False,
            )

    @function_tool
    async def request_advisor_callback(self, query_type: str, preferred_time: str = "") -> dict:
        """Log an advisor callback request for later, instead of a live transfer.

        Use this when the caller wants a callback rather than being connected
        right now, or when a live transfer isn't available/accepted.

        query_type: One of GMP, Valuation, Portfolio, Listing Gain, Other.
        preferred_time: Caller's preferred callback time, if given.
        """
        logging.info(
            "Advisor callback requested (query_type=%s, preferred_time=%s, customer=%s)",
            query_type, preferred_time, self.customer_info.get("name"),
        )
        return {"status": "logged", "query_type": query_type, "preferred_time": preferred_time}


if __name__ == "__main__":
    zeroruntime.serve(VoiceAgent, room=Room(recording=True), log_level=LOG_LEVEL)
