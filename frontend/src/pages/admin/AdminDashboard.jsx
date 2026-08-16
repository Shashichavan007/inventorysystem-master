import React from 'react';
import { useSearchParams } from 'react-router-dom';
import SystemHealth from './SystemHealth';
import EventFlow from './EventFlow';
import FailureLab from './FailureLab';
import DLQInspector from './DLQInspector';
import Observability from './Observability';
import Architecture from './Architecture';
import Overview from '../Overview';

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'metrics';

  switch (tab) {
    case 'health':
      return <SystemHealth />;
    case 'flow':
      return <EventFlow />;
    case 'simulation':
      return <FailureLab />;
    case 'dlq':
      return <DLQInspector />;
    case 'observability':
      return <Observability />;
    case 'architecture':
      return <Architecture />;
    default:
      return <Overview />;
  }
}
