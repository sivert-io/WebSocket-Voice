import { useEffect, useState } from "react";

interface HandlesHook {
  handles: Handle[];
  addHandle: (id: string) => void;
  removeHandle: (id: string) => void;
  isLoaded: boolean;
}

interface Handle {
  id: string;
}

export function useHandles(): HandlesHook {
  const [handles, setHandles] = useState<Handle[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    return () => {
      setIsLoaded(false);
    };
  }, []);

  function addHandle(id: string) {
    const handle: Handle = {
      id,
    };

    console.log("useHandles: Adding handle", id, "current handles:", handles.length);
    setHandles((old) => {
      const newHandles = [...old, handle];
      console.log("useHandles: New handles array length:", newHandles.length);
      return newHandles;
    });
  }

  function removeHandle(id: string) {
    console.log("useHandles: Removing handle", id, "current handles:", handles.length);
    setHandles((old) => {
      const newHandles = old.filter((handle) => handle.id !== id);
      console.log("useHandles: New handles array length:", newHandles.length);
      return newHandles;
    });
  }

  return {
    handles,
    addHandle,
    removeHandle,
    isLoaded,
  };
}
