import type { TourType } from "@/utils/actions";

const TourInfo = ({ tour }: { tour: TourType }) => {
  // console.log("tour", tour);
  const { title, description, stops, weatherInfo, estimatedPrice } = tour;

  return (
    <div className='max-w-2xl'>
      <h1 className='text-4xl font-semibold mb-4'>{title}</h1>
      <p className='font-semibold mb-4 '>
        Estimated Price:{" "}
        <span className='ml-2 text-xl font-bold italic text-primary'>
          {estimatedPrice}
        </span>
      </p>
      <div className='flex flex-wrap gap-x-4 mb-4'>
        {weatherInfo?.length > 0 &&
          weatherInfo.map((info) => (
            <p key={info} className='text-sm font-semibold'>
              {info}
            </p>
          ))}
      </div>

      <p className='leading-loose mb-6'>{description}</p>
      <ul>
        {stops.map((stop: string) => (
          <li key={stop} className='mb-4 bg-base-100 p-4 rounded-xl'>
            <p className='text'>{stop}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
export default TourInfo;
