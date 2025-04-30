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
  const query = `Find a exact ${city} in this exact ${country}.
If ${city} and ${country} exists, create a list of things families can do in this ${city},${country}. 
Once you have a list, create a one-day tour. Response should be in the following JSON format: 
{
  "tour": {
    "city": "${city}",
    "country": "${country}",
    "title": "title of the tour",
    "description": "description of the city and tour",
    "stops": ["short paragraph on the stop 1 ", "short paragraph on the stop 2","short paragraph on the stop 3"]
  }
}
If you can't find info on exact ${city}, or ${city} does not exist, or it's population is less than 1, or it is not located in the following ${country} return { "tour": null }, with no additional characters.`;

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

    const messageContent = response.choices[0].message.content;
    if (!messageContent) {
      return null;
    }

    // console.log(" messageContent----", messageContent);
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
