interface ErrorDisplayProps {
    error: string;
}

const ErrorDisplay = ({ error }: ErrorDisplayProps) => (
    <div className="text-center py-12 text-red-500">
      <p>{error}</p>
    </div>
);
export default ErrorDisplay;
