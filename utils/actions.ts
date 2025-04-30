"use server";

import prisma from "@/prisma/db";
import type { Tour } from "@prisma/client";
import { revalidatePath } from "next/cache";

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";

export type TourType = {
  city: string;
  country: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  description: string;
  image?: string | null;
  stops: string[];
  estimatedPrice: string | null;
  weatherInfo: string[];
};

type ChatMessage = ChatCompletionMessageParam;

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// update to gemini api key;
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export const generateChatResponse = async (
  chatMessages: ChatMessage[]
): Promise<{ message: ChatMessage; tokens: number }> => {
  try {
    const completion = await openai.chat.completions.create({
      // model: "gpt-4o-mini",
      model: "gemini-2.0-flash-lite",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        ...chatMessages,
      ],
      temperature: 0,
      max_completion_tokens: 500,
    });
    // console.log("completion", completion.choices[0].message);

    return {
      message: completion.choices[0].message as ChatMessage,
      tokens: completion.usage?.total_tokens ?? 0,
    };
  } catch (error) {
    return {
      message: {
        content: "I'm sorry, I'm having trouble understanding you right now.",
        role: "assistant",
      },
      tokens: 0,
    };
  }
};

// generate Tour Response;
export const generateTourResponse = async ({
  city,
  country,
}: {
  city: string;
  country: string;
}): Promise<{ tour: Tour; tokens: number } | null> => {
  // prompt for generating a travel plan;
  const query = `Generate a one-day travel plan for the city of ${city} in ${country}. Return the response strictly as clean, plain JSON (no markdown or text outside JSON). Include the following structured fields:

{
  "tour": {
    "city": "${city}",
    "country": "${country}",
    "title": "A descriptive and engaging title for the trip",
    "estimatedPrice": "An estimated total cost for the one-day tour in USD. Use $80–$250 depending on how touristy or expensive the city is.",
    "description": "A short, exciting overview of the destination and tour",
    "weatherInfo": [
      "☀️ Spring: 59–77°F (15–25°C)",
      "🌦️ Summer: 68–86°F (20–30°C)",
      "🍂 Fall: 50–68°F (10–20°C)",
      "❄️ Winter: 32–50°F (0–10°C)"
    ],
    "stops": [
      "A short paragraph describing the first stop, with details of what to see or do.",
      "A short paragraph for the second stop, focusing on local experience.",
      "A short paragraph for the final stop, including food, views, or shopping."
    ]
  }
}

Important:
- Only respond with the final JSON.
- Do not include markdown, explanation, or extra text.
- Keep temperature ranges and prices realistic.
- Ensure the JSON is valid and well-structured.
- Return ONLY a raw JSON object. DO NOT wrap the result in any markdown.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gemini-2.0-flash-lite",
      messages: [
        { role: "system", content: "you are a tour guide" },
        { role: "user", content: query },
      ],
      temperature: 0,
      max_completion_tokens: 500,
    });

    let messageContent = response.choices[0].message.content;
    if (!messageContent) {
      return null;
    }

    // console.log(" messageContent----", messageContent);

    //  ```json blocks if present
    if (messageContent.startsWith("```json") || messageContent.startsWith("```")) {
      messageContent = messageContent
        .replace(/```(json)?/, "")
        .replace(/```$/, "")
        .trim();
    }

    const tourData = JSON.parse(messageContent);

    // return tourData.tour;
    return { tour: tourData.tour, tokens: response.usage?.total_tokens ?? 0 };
  } catch (error) {
    console.log(error);
    return null;
  }
};

// create tour;
export const createTour = async (tour: Tour) => {
  tour.city = tour.city.toLowerCase();
  tour.country = tour.country.toLowerCase();
  return prisma.tour.create({
    data: { ...tour, stops: tour.stops ?? [] },
  });
};

// get existing tour;
export const getExistingTour = async ({
  city,
  country,
}: {
  city: string;
  country: string;
}): Promise<Tour | null> => {
  const cityData = city.toLowerCase();
  const countryData = country.toLowerCase();

  return prisma.tour.findUnique({
    where: {
      city_country: { city: cityData, country: countryData },
    },
  });
};

// get all tours;
export const getAllTours = async (searchTerm: string) => {
  if (searchTerm === "") {
    const tours = await prisma.tour.findMany({
      orderBy: {
        city: "asc",
      },
    });
    return tours;
  }

  // search for tours by city or country;
  const tours = await prisma.tour.findMany({
    where: {
      OR: [
        {
          city: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          country: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: {
      city: "asc",
    },
  });
  return tours;
};

// get tour by id;
export const getTourById = async (id: string): Promise<Tour | null> => {
  return prisma.tour.findUnique({
    where: { id },
  });
};

// generate Tour Image
export const generateTourImage = async ({
  city,
  country,
}: {
  city: string;
  country: string;
}) => {
  try {
    const tourImage = await openai.images.generate({
      prompt: `A panoramic view of of ${city}, ${country}`,
      n: 1,
      size: "512x512",
    });
    return tourImage?.data[0]?.url;
  } catch (error) {
    return null;
  }
};

// fetch or create tokens;
export const fetchOrCreateTokens = async (clerkId: string) => {
  // fetch tokens;
  const existTokens = await prisma.token.findUnique({
    where: {
      clerkId,
    },
  });
  if (existTokens) {
    return existTokens?.tokens;
  }

  // create tokens;
  const result = await prisma.token.create({
    data: {
      clerkId,
    },
  });

  return result?.tokens;
};

// subtract tokens;
export const subtractTokens = async (clerkId: string, tokens: number) => {
  const result = await prisma.token.update({
    where: {
      clerkId,
    },
    data: {
      tokens: {
        decrement: tokens,
      },
    },
  });

  revalidatePath("/profile");
  return result.tokens;
};
