import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  PanResponder,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  data: any[];
  renderItem: (item: any, dragTrigger: any) => React.ReactNode;
  onReorder: (newData: any[]) => void;
  itemHeight: number;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const JSReorderList = ({ data, renderItem, onReorder, itemHeight, onDragStateChange }: Props) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number>(-1);
  const [localData, setLocalData] = useState(data);
  
  const panY = useRef(new Animated.Value(0)).current;
  const activeIdRef = useRef<string | null>(null);
  const originalIndexRef = useRef<number>(-1);
  const hoverIndexRef = useRef<number>(-1);
  const localDataRef = useRef(data);

  // Sync localData and Ref whenever data prop changes
  useEffect(() => {
    if (!activeId) {
      setLocalData(data);
      localDataRef.current = data;
    }
  }, [data, activeId]);

  const onDragStart = (id: string) => {
    // Crucial: Use the current state of localDataRef
    const idx = localDataRef.current.findIndex(d => d.id === id);
    if (idx === -1) return;

    originalIndexRef.current = idx;
    hoverIndexRef.current = idx;
    activeIdRef.current = id;
    
    // Set state for rendering
    setActiveId(id);
    setHoverIndex(idx);
    panY.setValue(0);
    onDragStateChange?.(true);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => !!activeIdRef.current,
      onPanResponderMove: (_, gesture) => {
        if (!activeIdRef.current) return;
        
        panY.setValue(gesture.dy);

        // Calculate index change
        const indexChange = Math.round(gesture.dy / itemHeight);
        const targetIndex = Math.max(0, Math.min(localDataRef.current.length - 1, originalIndexRef.current + indexChange));
        
        if (targetIndex !== hoverIndexRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          hoverIndexRef.current = targetIndex;
          setHoverIndex(targetIndex);
        }
      },
      onPanResponderRelease: () => {
        if (!activeIdRef.current) return;
        
        const finalTarget = hoverIndexRef.current;
        const currentId = activeIdRef.current;
        
        if (finalTarget !== originalIndexRef.current && finalTarget !== -1) {
          const newData = [...localDataRef.current];
          const [removed] = newData.splice(originalIndexRef.current, 1);
          newData.splice(finalTarget, 0, removed);
          
          localDataRef.current = newData;
          setLocalData(newData);
          onReorder(newData);
        }

        // Cleanup
        activeIdRef.current = null;
        setActiveId(null);
        setHoverIndex(-1);
        hoverIndexRef.current = -1;
        panY.setValue(0);
        onDragStateChange?.(false);
      },
      onPanResponderTerminate: () => {
        activeIdRef.current = null;
        setActiveId(null);
        setHoverIndex(-1);
        hoverIndexRef.current = -1;
        panY.setValue(0);
        onDragStateChange?.(false);
      }
    })
  ).current;

  return (
    <View {...panResponder.panHandlers}>
      {localData.map((item, index) => {
        const isActive = activeId === item.id;
        
        let translateY = 0;
        if (activeId && !isActive) {
          // Shifting logic
          if (index > originalIndexRef.current && index <= hoverIndex) {
            translateY = -itemHeight;
          } else if (index < originalIndexRef.current && index >= hoverIndex) {
            translateY = itemHeight;
          }
        }

        return (
          <Animated.View
            key={item.id}
            style={[
              { height: itemHeight },
              isActive ? {
                zIndex: 999,
                transform: [{ translateY: panY }, { scale: 1.05 }],
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 15,
                elevation: 20,
              } : {
                zIndex: 1,
                transform: [{ translateY: translateY }],
              },
            ]}
          >
            {renderItem(item, () => onDragStart(item.id))}
          </Animated.View>
        );
      })}
    </View>
  );
};

