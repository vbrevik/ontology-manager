import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListBulletIcon, DashboardIcon, GlobeIcon } from '@radix-ui/react-icons';

export type ViewMode = 'list' | 'kanban' | 'map';

interface ViewSwitcherProps {
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
    return (
        <Tabs value={currentView} onValueChange={(v) => onViewChange(v as ViewMode)}>
            <TabsList className="bg-slate-900 border border-slate-800">
                <TabsTrigger value="list" className="data-[state=active]:bg-slate-800">
                    <ListBulletIcon className="w-4 h-4 mr-2" />
                    List
                </TabsTrigger>
                <TabsTrigger value="kanban" className="data-[state=active]:bg-slate-800">
                    <DashboardIcon className="w-4 h-4 mr-2" />
                    Kanban
                </TabsTrigger>
                <TabsTrigger value="map" className="data-[state=active]:bg-slate-800">
                    <GlobeIcon className="w-4 h-4 mr-2" />
                    Map
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
