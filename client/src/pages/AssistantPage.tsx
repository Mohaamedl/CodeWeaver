import { useState } from 'react';
import AssistantChat from '@/components/AssistantChat';

const AssistantPage = () => {
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);

  const handleAssistantComplete = (plan: any) => {
    setGeneratedPlan(plan);
  };

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Interactive Assistant</h1>
        
        <AssistantChat onComplete={handleAssistantComplete} />
      </div>
    </div>
  );
};

export default AssistantPage;
