"use client";

import TourInfo from "@/components/TourInfo";
import {
  createTour,
  fetchOrCreateTokens,
  generateTourResponse,
  getExistingTour,
  subtractTokens,
  TourType,
} from "@/utils/actions";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import toast from "react-hot-toast";

type DestinationType = {
  city: string;
  country: string;
};

type TourInfoProps = {
  tour: TourType;
};

const NewTour = () => {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  // mutation
  const {
    mutate,
    isPending,
    data: tour,
  } = useMutation({
    mutationFn: async (destination: DestinationType) => {
      // check if user is logged in
      if (!userId) {
        toast.error("User ID is missing");
        return null;
      }
      // check if user has enough tokens
      const currentTokens = await fetchOrCreateTokens(userId);
      if (currentTokens < 300) {
        toast.error("You don't have enough tokens");
        return null;
      }

      // check if tour already exists
      const existingTour = await getExistingTour(destination);
      if (existingTour) {
        return { ...existingTour, stops: existingTour.stops as string[] };
      }

      // generate new tour
      const newTour = await generateTourResponse(destination);
      if (!newTour) {
        toast.error("No data returned...");
        return null;
      }

      const response = await createTour(newTour.tour);

      queryClient.invalidateQueries({ queryKey: ["tours"] });
      // remaining tokens
      const newTokens = await subtractTokens(userId, newTour.tokens);
      toast.success(`Tour created. Tokens left: ${newTokens}`);
      return { ...newTour.tour, stops: newTour.tour.stops as string[] };
    },
  });

  // handle submit
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const destination = Object.fromEntries(formData.entries()) as DestinationType;
    mutate(destination);
  };

  if (isPending) {
    return <div className='loading loading-lg'> </div>;
  }

  return (
    <>
      <form action='' className='max-w-2xl' onSubmit={handleSubmit}>
        <h2 className='mb-8 lg:my-12 font-xl lg:font-2xl'>Generate your destination</h2>
        <div className='join w-full'>
          <input
            type='text'
            className='input input-bordered join-item w-full'
            placeholder='city'
            name='city'
            required
          />
          <input
            type='text'
            className='input input-bordered join-item w-full'
            placeholder='country'
            name='country'
            required
          />
          <button className='btn btn-primary join-item' type='submit'>
            Generate Tour
          </button>
        </div>
      </form>

      <div className='mt-16'> {tour ? <TourInfo tour={tour} /> : null}</div>
    </>
  );
};
export default NewTour;
