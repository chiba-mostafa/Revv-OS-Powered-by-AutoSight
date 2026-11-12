const {
  Modality,
  createGeminiClient,
  getProjectId,
  normalizeGeminiModelId,
} = require("../config/aiConfig");
const { broadcast } = require("./editorEventBus");

const EDITOR_LIVE_MODEL = normalizeGeminiModelId(
  process.env.GEMINI_LIVE_EDITOR_MODEL ||
    process.env.GEMINI_LIVE_CHATBOT_MODEL ||
    "gemini-live-2.5-flash-native-audio",
);
const EDITOR_LIVE_LOCATION =
  process.env.GEMINI_LIVE_EDITOR_LOCATION ||
  process.env.GEMINI_LIVE_LOCATION ||
  (process.env.GOOGLE_CLOUD_LOCATION === "global"
    ? "us-central1"
    : process.env.GOOGLE_CLOUD_LOCATION) ||
  "us-central1";

function buildEditorTools() {
  return [
    {
      functionDeclarations: [
        {
          name: "update_scene_text",
          description:
            "Update the text content of a specific scene. Use this for headline, paragraph, or voiceover wording tweaks.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              sceneIndex: {
                type: "integer",
                description: "Zero-based index of the scene to update.",
              },
              field: {
                type: "string",
                enum: ["headline", "paragraph", "voiceover"],
                description:
                  "Which text field to update: headline, paragraph, or voiceover.",
              },
              text: {
                type: "string",
                description: "The new text content for the field.",
              },
            },
            required: ["sceneIndex", "field", "text"],
            additionalProperties: false,
          },
        },
        {
          name: "change_layout",
          description:
            "Change the visual layout of a specific scene, including composition and card position.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              sceneIndex: {
                type: "integer",
                description: "Zero-based index of the scene to change.",
              },
              composition: {
                type: "string",
                enum: [
                  "split-image-left",
                  "split-image-right",
                  "full-bleed",
                  "overlay-bottom",
                  "centered-focus",
                ],
                description: "The new layout composition.",
              },
              card_position: {
                type: "string",
                enum: ["left", "right"],
                description:
                  "Which side of the frame the info card should appear on.",
              },
            },
            required: ["sceneIndex"],
            additionalProperties: false,
          },
        },
        {
          name: "change_theme",
          description:
            "Switch the global presentation theme between Cinematic and Minimal Tech.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              theme: {
                type: "string",
                enum: ["cinematic", "minimaltech"],
                description: "The target theme.",
              },
            },
            required: ["theme"],
            additionalProperties: false,
          },
        },
        {
          name: "update_meta",
          description:
            "Update global story metadata such as the presentation theme or language.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              template: {
                type: "string",
                enum: ["cinematic", "minimaltech"],
                description: "The target theme for the whole presentation.",
              },
              language: {
                type: "string",
                enum: ["en", "fr"],
                description: "The target language for the whole presentation.",
              },
            },
            additionalProperties: false,
          },
        },
        {
          name: "navigate_scene",
          description: "Navigate the editor to a specific scene by index.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              sceneIndex: {
                type: "integer",
                description: "Zero-based index of the scene to navigate to.",
              },
            },
            required: ["sceneIndex"],
            additionalProperties: false,
          },
        },
        {
          name: "add_scene",
          description:
            "Add a new scene to the story at a given position. Supports slide_view and tech_view scenes.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              sceneType: {
                type: "string",
                enum: ["slide_view", "tech_view"],
                description: "Scene type to create.",
              },
              techMode: {
                type: "string",
                enum: ["PERFORMANCE", "SAFETY", "UTILITY"],
                description: "For tech_view scenes only.",
              },
              headline: {
                type: "string",
                description: "Headline text for the new scene.",
              },
              paragraph: {
                type: "string",
                description: "Paragraph or body text for the new scene.",
              },
              afterIndex: {
                type: "integer",
                description:
                  "Insert after this zero-based index. Use -1 to append at the end.",
              },
              voiceover_text: {
                type: "string",
                description: "Optional voiceover narration for the new scene.",
              },
            },
            required: ["headline", "paragraph"],
            additionalProperties: false,
          },
        },
        {
          name: "remove_scene",
          description: "Remove a scene from the story by its index.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              sceneIndex: {
                type: "integer",
                description: "Zero-based index of the scene to remove.",
              },
            },
            required: ["sceneIndex"],
            additionalProperties: false,
          },
        },
        {
          name: "regenerate_scene",
          description:
            "Regenerate a scene with new content and a fresh background image.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              sceneIndex: {
                type: "integer",
                description: "Zero-based index of the scene to regenerate.",
              },
              headline: {
                type: "string",
                description: "New headline for the scene.",
              },
              paragraph: {
                type: "string",
                description: "New body text for the scene.",
              },
              voiceover_text: {
                type: "string",
                description: "New voiceover narration.",
              },
              imagePrompt: {
                type: "string",
                description: "Detailed prompt for the regenerated background image.",
              },
            },
            required: ["sceneIndex"],
            additionalProperties: false,
          },
        },
        {
          name: "update_all_scenes",
          description:
            "Batch-update every scene in the story for full retheme, translation, or narrative-wide rewrites.",
          parametersJsonSchema: {
            type: "object",
            properties: {
              voice: {
                type: "string",
                description: "Optional Google voice model to use for regenerated voiceovers.",
              },
              sceneUpdates: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sceneIndex: {
                      type: "integer",
                      description: "Zero-based scene index.",
                    },
                    updates: {
                      type: "object",
                      description:
                        "Partial scene updates. Can include intro_content, slide_content, outro_content, and voiceover_text.",
                    },
                    imagePrompt: {
                      type: "string",
                      description:
                        "Detailed image regeneration prompt for non-tech scenes.",
                    },
                  },
                  required: ["sceneIndex", "updates"],
                  additionalProperties: true,
                },
              },
            },
            required: ["sceneUpdates"],
            additionalProperties: false,
          },
        },
      ],
    },
  ];
}

function buildEditorGroundingPrompt(storyData, currentSceneIndex) {
  const car = storyData?.car || {};
  const carLabel =
    `${car.year || ""} ${car.make || ""} ${car.model || ""}`.trim() ||
    "Unknown Vehicle";
  const template = storyData?.meta?.template || "cinematic";
  const language = storyData?.language || "en";

  const specs = storyData?.car_specs || {};
  const perf = specs.performance || {};
  const safety = specs.safety || {};
  const dims = specs.dimensions || {};
  const specLines = [];
  if (perf.hp) specLines.push(`  HP: ${perf.hp}`);
  if (perf.torque_nm) specLines.push(`  Torque: ${perf.torque_nm} Nm`);
  if (perf.zero_to_sixty_sec) specLines.push(`  0-60: ${perf.zero_to_sixty_sec}s`);
  if (perf.drivetrain) specLines.push(`  Drivetrain: ${perf.drivetrain}`);
  if (perf.top_speed_kmh) specLines.push(`  Top Speed: ${perf.top_speed_kmh} km/h`);
  if (safety.airbags) specLines.push(`  Airbags: ${safety.airbags}`);
  if (dims.trunk_capacity_l) specLines.push(`  Trunk: ${dims.trunk_capacity_l} L`);
  if (dims.seats) specLines.push(`  Seats: ${dims.seats}`);
  const specsBlock =
    specLines.length > 0 ? specLines.join("\n") : "  (no specs available)";

  const scenes = storyData?.scenes || [];
  const sceneSummary = scenes
    .map((scene, index) => {
      const headline =
        scene.slide_content?.headline ||
        scene.intro_content?.title ||
        scene.outro_content?.headline ||
        `Scene ${index + 1}`;
      const paragraph =
        scene.slide_content?.paragraph ||
        scene.intro_content?.subtitle ||
        scene.outro_content?.subheadline ||
        "";
      const marker = index === currentSceneIndex ? " <-- CURRENT" : "";
      return `  ${index}: [${scene.type}] card_position="${scene.layout?.card_position || scene.slide_content?.alignment || (scene.type === "tech_view" ? "right" : "left")}" "${headline}" - ${paragraph.slice(0, 80)}${marker}`;
    })
    .join("\n");

  return `You are the AutoSight Copilot, a real-time voice assistant for the dealer story editor.
You help dealers edit a ${carLabel} presentation through natural voice commands.

VEHICLE: ${carLabel}
CAR SPECIFICATIONS (use real numbers, never hallucinate):
${specsBlock}

CURRENT STORY STATE:
- Theme: ${template}
- Language: ${language}
- Total Scenes: ${scenes.length}
- Current scene index: ${currentSceneIndex}

SCENE OVERVIEW:
${sceneSummary || "  (no scenes)"}

TOOLING RULES:
- Use update_scene_text for minor text changes.
- Use change_layout for composition or card-position changes.
- Use add_scene for new slide_view or tech_view scenes.
- Use remove_scene to delete scenes.
- Use regenerate_scene when a scene's visual focus changes and a new image is needed.
- Use update_meta followed by update_all_scenes for whole-story rethemes or translations.
- Preserve scene order during full-story updates.
- For tech_view scenes, do not request image prompts.
- When switching language, choose a matching Google Chirp HD voice.
- If the user says "this scene" or "current scene", use scene index ${currentSceneIndex}.

RESPONSE STYLE:
- Speak briefly and clearly.
- Confirm completed actions in 1-2 sentences.
- Stay grounded in the current story and vehicle data.

Today's date: ${new Date().toISOString().split("T")[0]}`;
}

function extractTextParts(modelTurn) {
  return (modelTurn?.parts || [])
    .filter((part) => typeof part?.text === "string" && part.text.trim())
    .map((part) => part.text);
}

function extractAudioParts(modelTurn) {
  return (modelTurn?.parts || [])
    .filter((part) => part?.inlineData?.data)
    .map((part) => ({
      mimeType: part.inlineData.mimeType || "audio/pcm",
      data: part.inlineData.data,
    }));
}

function dispatchEditorToolCall(name, input, carId) {
  broadcast("tool_call", {
    type: name,
    payload: input,
    carId,
  });
}

async function executeToolUse({ toolName, input, carId }) {
  dispatchEditorToolCall(toolName, input, carId);
  return {
    status: "success",
    tool: toolName,
    message:
      "The editor action has been dispatched successfully. Briefly confirm what changed for the dealer.",
    payload: input,
  };
}

function createStopPromise(abortSignal) {
  if (!abortSignal) {
    return new Promise(() => {});
  }

  if (abortSignal.aborted) {
    return Promise.resolve({ done: true });
  }

  return new Promise((resolve) => {
    abortSignal.addEventListener("abort", () => resolve({ done: true }), {
      once: true,
    });
  });
}

async function startEditorVoiceSession(
  audioStream,
  carId,
  storyData,
  currentSceneIndex = 0,
  onAudioChunk,
  abortSignal,
) {
  const project = getProjectId();

  if (!project) {
    throw new Error(
      "Gemini Live editor voice requires Vertex AI project configuration.",
    );
  }

  const regionalClient = createGeminiClient({
    project,
    location: EDITOR_LIVE_LOCATION,
  });

  let sessionClosed = false;
  let resolveSessionDone;
  const sessionDone = new Promise((resolve) => {
    resolveSessionDone = resolve;
  });

  let userTranscriptBuffer = "";
  let assistantTranscriptBuffer = "";

  const liveSession = await regionalClient.live.connect({
    model: EDITOR_LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 1024,
      systemInstruction: buildEditorGroundingPrompt(
        storyData,
        currentSceneIndex,
      ),
      tools: buildEditorTools(),
      speechConfig: {
        languageCode: "en-US",
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName:
              process.env.GEMINI_LIVE_EDITOR_VOICE ||
              process.env.GEMINI_LIVE_VOICE ||
              "Aoede",
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      enableAffectiveDialog: true,
      sessionResumption: { transparent: true },
    },
    callbacks: {
      onopen: () => {
        console.log(
          `[EditorVoice] Gemini Live connected (${EDITOR_LIVE_MODEL} @ ${EDITOR_LIVE_LOCATION}) for car: ${carId}`,
        );
      },
      onmessage: async (message) => {
        if (message.setupComplete?.sessionId) {
          broadcast("status", {
            type: "connected",
            carId,
            sessionId: message.setupComplete.sessionId,
          });
        }

        if (message.sessionResumptionUpdate?.newHandle) {
          broadcast("status", {
            type: "session_resumption",
            carId,
            resumable: Boolean(message.sessionResumptionUpdate.resumable),
          });
        }

        if (message.goAway) {
          broadcast("status", {
            type: "go_away",
            carId,
            timeLeft: message.goAway.timeLeft || null,
          });
        }

        if (message.serverContent?.interrupted) {
          assistantTranscriptBuffer = "";
          broadcast("status", {
            type: "interrupted",
            carId,
          });
        }

        if (message.serverContent?.inputTranscription?.text) {
          userTranscriptBuffer = String(
            message.serverContent.inputTranscription.text || "",
          ).trim();

          if (userTranscriptBuffer && message.serverContent.turnComplete) {
            broadcast("user_transcript", {
              text: userTranscriptBuffer,
              carId,
              isFinal: true,
            });
            userTranscriptBuffer = "";
          }
        }

        if (message.serverContent?.outputTranscription?.text) {
          const transcript = String(
            message.serverContent.outputTranscription.text || "",
          );
          const delta = transcript.startsWith(assistantTranscriptBuffer)
            ? transcript.slice(assistantTranscriptBuffer.length)
            : transcript;

          assistantTranscriptBuffer = transcript;

          if (delta) {
            broadcast("ai_response", {
              text: delta,
              carId,
              streamId: "assistant-live-stream",
              isFinal: false,
            });
          }

          if (message.serverContent.turnComplete) {
            broadcast("ai_response", {
              text: "",
              carId,
              streamId: "assistant-live-stream",
              isFinal: true,
            });
            assistantTranscriptBuffer = "";
          }
        } else if (message.serverContent?.turnComplete) {
          broadcast("ai_response", {
            text: "",
            carId,
            streamId: "assistant-live-stream",
            isFinal: true,
          });
          assistantTranscriptBuffer = "";
        }

        if (message.serverContent?.modelTurn) {
          const audioParts = extractAudioParts(message.serverContent.modelTurn);
          for (const part of audioParts) {
            if (onAudioChunk) {
              onAudioChunk(Buffer.from(part.data, "base64"), part.mimeType);
            }
          }

          if (!message.serverContent.outputTranscription) {
            const joined = extractTextParts(message.serverContent.modelTurn).join(
              "",
            );
            if (joined) {
              broadcast("ai_response", {
                text: joined,
                carId,
                streamId: "assistant-live-stream",
                isFinal: false,
              });
            }
          }
        }

        if (message.toolCall?.functionCalls?.length) {
          const responses = [];

          for (const call of message.toolCall.functionCalls) {
            try {
              const output = await executeToolUse({
                toolName: call.name,
                input: call.args || {},
                carId,
              });

              responses.push({
                id: call.id,
                name: call.name,
                response: output,
              });
            } catch (error) {
              console.error(
                `[EditorVoice] Tool ${call.name} failed:`,
                error.message,
              );
              responses.push({
                id: call.id,
                name: call.name,
                response: {
                  status: "error",
                  message:
                    "The editor action failed. Apologize briefly and ask the dealer to try again.",
                },
              });
            }
          }

          if (responses.length > 0) {
            liveSession.sendToolResponse({ functionResponses: responses });
          }
        }
      },
      onerror: (error) => {
        console.error(
          "[EditorVoice] Gemini Live session error:",
          error?.error || error,
        );
        broadcast("status", {
          type: "error",
          carId,
          message: error?.error?.message || error?.message || "Voice session failed.",
        });
      },
      onclose: () => {
        sessionClosed = true;
        broadcast("status", {
          type: "disconnected",
          carId,
        });
        resolveSessionDone();
      },
    },
  });

  const iterator = audioStream[Symbol.asyncIterator]();
  const stopPromise = createStopPromise(abortSignal);

  try {
    while (!sessionClosed && !abortSignal?.aborted) {
      const nextResult = await Promise.race([
        iterator.next(),
        sessionDone.then(() => ({ done: true })),
        stopPromise,
      ]);

      if (!nextResult || nextResult.done) {
        break;
      }

      const pcm = nextResult.value?.audio?.data;
      if (!pcm || pcm.length === 0) {
        continue;
      }

      liveSession.sendRealtimeInput({
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: Buffer.from(pcm).toString("base64"),
        },
      });
    }
  } finally {
    try {
      await iterator.return?.();
    } catch {}

    try {
      liveSession.sendRealtimeInput({ audioStreamEnd: true });
    } catch {}

    try {
      liveSession.close();
    } catch {}

    await Promise.race([
      sessionDone,
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
}

module.exports = {
  EDITOR_LIVE_LOCATION,
  EDITOR_LIVE_MODEL,
  startEditorVoiceSession,
};
