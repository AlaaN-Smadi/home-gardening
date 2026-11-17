import { GoogleGenAI } from "@google/genai";

// Initialize the GoogleGenAI client exclusively using process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getRecyclingTip = async () => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: "أعطني نصيحة أو معلومة محفزة وسريعة لطالبات المدارس عن إعادة التدوير وفرز النفايات في جملة واحدة باللغة العربية مع عبارة تشجيعية.",
      config: {
        systemInstruction: "أنتِ مرشدة ذكية ولطيفة لإعادة التدوير في المدارس. قدمي نصائح قصيرة وممتعة ومحفزة للطالبات باللغة العربية.",
        temperature: 0.7,
      },
    });
    return response.text || "كل علبة بلاستيكية تفرزينها اليوم تصنع فرقاً كبيراً في بيئتنا المدرسية!";
  } catch (error) {
    console.error("Error fetching recycling tip:", error);
    return "فرز النفايات خطوتكِ الذكية لمدرسة أجمل ونقاط أكثر!";
  }
};

// Keep backwards-compatible alias
export const getGardeningTip = getRecyclingTip;

export const chatWithMentor = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  try {
    const chat = ai.chats.create({
      model: "gemini-3.8-flash",
      config: {
        systemInstruction: "أنتِ 'تدويرة'، المرشدة الذكية لإعادة التدوير والاستدامة في البيئة المدرسية، والمشجعة لفتيات وطالبات المدارس. لغتكِ لطيفة، محفزة، مرحة وبسيطة باللغة العربية. تساعدين الطالبات في كيفية فرز النفايات المدرسية (بلاستيك، ورق، علب عصير، أطعمة)، وتقدمين أفكاراً إبداعية لإعادة تدوير الأدوات المدرسية والعلب الفارغة، وتشرحين لهن كيف يجمعن النقاط لاستبدالها بمكافآت من المقصف المدرسي وإدارة المدرسة.",
      },
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Mentor chat error:", error);
    return "عذراً يا بطلة البيئة! يبدو أن لدي مشكلة بسيطة في الاتصال بالشبكة حالياً. حاولي مرة أخرى وسأكون في انتظاركِ!";
  }
};
