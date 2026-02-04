
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the GoogleGenAI client exclusively using process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getGardeningTip = async () => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "أعطني نصيحة سريعة ومحفزة لطلاب المدارس عن الزراعة المنزلية في جملة واحدة باللغة العربية.",
      config: {
        systemInstruction: "You are a friendly gardening mentor for kids. Keep responses brief, encouraging, and in Arabic.",
        temperature: 0.7,
      },
    });
    // Property .text is used to extract the content.
    return response.text || "ازرع نبتتك اليوم لتشاهد جمال الطبيعة غداً!";
  } catch (error) {
    console.error("Error fetching gardening tip:", error);
    return "الزراعة حياة، حافظ على نبتتك!";
  }
};

export const chatWithMentor = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  try {
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: "أنت مرشد زراعي خبير وصديق للطلاب. اسمك 'زراعي'. تساعدهم في حل مشاكل نباتاتهم وتشجعهم على الزراعة المنزلية. كن مرحاً وبسيطاً في لغتك.",
      },
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Mentor chat error:", error);
    return "عذراً، لدي مشكلة في الاتصال بجذوري الآن. حاول مجدداً لاحقاً!";
  }
};
