import asyncio
import logging
import os

import zeroruntime
from zeroruntime import Agent, AgentContext, EOUConfig, InterruptConfig, Pipeline, Room, function_tool
from zeroruntime.inference import TurnDetector, GoogleLLM, DeepgramSTT, CartesiaTTS
from zeroruntime.plugins import SileroVAD
from dotenv import load_dotenv

from instruction import INSTRUCTIONS

load_dotenv(override=True)


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
AGENT_ID = os.getenv("AGENT_ID", "ag_zzq3b1")

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
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
            min_silence_duration=0.8,
            min_speech_duration=0.05,
            min_volume=0.01,
            energy_filter_enabled=True,
        ),
        eou=EOUConfig(mode="DEFAULT", min_max_speech_wait_timeout=[0.0, 0.0]),
     )


class VoiceAgent(Agent):
    def __init__(self, ctx: AgentContext) -> None:
        meta = dict(ctx.metadata) if ctx.metadata else {}
        customer_name = meta.get("name") or "Sovan"
        super().__init__(
            agent_id=AGENT_ID,
            instructions=INSTRUCTIONS,
            pipeline=build_pipeline(),
        )

        self.customer_info = {"name": customer_name}
        self.call_metadata = meta
        self._history = None 

    async def on_enter(self) -> None:
        await self.session.say(
            f"Hello, kya main {self.customer_info['name']} ji se baat kar rahi hoon?"
        )
 
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


if __name__ == "__main__":
    zeroruntime.serve(VoiceAgent, room=Room(recording=True), log_level=LOG_LEVEL)
