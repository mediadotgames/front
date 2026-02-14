import { useAnomalies } from "../hooks/useAnomalies";
import { toErrorWithMessage } from "./utils/errortypes";

export const DataViewer = () => {
  const { data, loading, error } = useAnomalies();
  if (loading) return <div>Loading...</div>;
  if (error){
    const errorWithMessage = toErrorWithMessage(error);
    return <div>Error: {errorWithMessage.message}</div>;
  } 
  return (
    <div>
      <h1>DataViewer</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
